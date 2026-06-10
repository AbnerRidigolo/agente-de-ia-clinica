import { db } from "../db.js";
import { executeTool } from "./tools.js";

/** Extrai telefone brasileiro (10 ou 11 dígitos) mesmo com texto ao redor. */
export function extractPhone(text: string): string | null {
  const candidates: string[] = [];

  for (const match of text.matchAll(/\d[\d\s().-]{7,14}\d/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 11) candidates.push(digits);
    if (digits.length === 13 && digits.startsWith("55")) candidates.push(digits.slice(2));
  }

  const allDigits = text.replace(/\D/g, "");
  if (allDigits.length >= 10 && allDigits.length <= 11) candidates.push(allDigits);
  if (allDigits.length === 13 && allDigits.startsWith("55")) candidates.push(allDigits.slice(2));

  const mobile = allDigits.match(/(\d{2}9\d{8})/);
  if (mobile) candidates.push(mobile[1]);

  return (
    candidates.find((d) => d.length === 11 && d[2] === "9") ??
    candidates.find((d) => d.length === 10) ??
    null
  );
}

/** Tenta extrair nome completo de mensagens comuns de cadastro. */
export function extractName(text: string): string | null {
  const patterns = [
    /(?:meu nome (?:é|e)|me chamo|sou (?:o|a)?)\s+(.+?)(?:[,.]|$)/i,
    /^\d+[,.]?\s*(.+?)[,.]?\s*\d{10,11}/i,
    /^(.+?)[,.]?\s*\d{10,11}/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = match[1]
      .trim()
      .replace(/\d{10,13}/g, "")
      .replace(/^(nome|name)\s*:?\s*/i, "")
      .trim();
    if (name.length >= 3 && /[a-záàâãéêíóôõúç]/i.test(name)) return name;
  }

  return null;
}

function findPhoneInHistory(conversationId: number): string | null {
  const rows = db
    .prepare("SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY id")
    .all(conversationId) as { content: string }[];

  for (let i = rows.length - 1; i >= 0; i--) {
    const phone = extractPhone(rows[i].content);
    if (phone) return phone;
  }

  return null;
}

function getLastPatientLookup(conversationId: number): string | null {
  const row = db
    .prepare(
      "SELECT content FROM messages WHERE conversation_id = ? AND tool_name = 'buscar_paciente' ORDER BY id DESC LIMIT 1"
    )
    .get(conversationId) as { content: string } | undefined;
  return row?.content ?? null;
}

export interface PreflightContext {
  systemNote: string;
  toolExecutions: { name: string; result: string; intent?: string }[];
}

/**
 * Camada determinística: detecta telefone/nome na mensagem (ou no histórico),
 * executa buscar_paciente automaticamente e injeta contexto para o modelo.
 */
export function runPreflightContext(
  conversationId: number,
  userText: string
): PreflightContext | null {
  const phone = extractPhone(userText) ?? findPhoneInHistory(conversationId);
  if (!phone) return null;

  db.prepare("UPDATE conversations SET contact = ? WHERE id = ?").run(phone, conversationId);

  const notes = [
    `Telefone identificado automaticamente: ${phone}.`,
    "O paciente JÁ informou o telefone — NÃO peça novamente. Use os dados abaixo para continuar.",
  ];

  const name = extractName(userText);
  if (name) notes.push(`Nome identificado na mensagem: ${name}.`);

  const toolExecutions: PreflightContext["toolExecutions"] = [];
  const previousLookup = getLastPatientLookup(conversationId);

  if (!previousLookup) {
    const outcome = executeTool("buscar_paciente", { telefone: phone }, conversationId);
    toolExecutions.push({
      name: "buscar_paciente",
      result: outcome.result,
      intent: outcome.intent,
    });
    notes.push(`Resultado de buscar_paciente: ${outcome.result}`);
  } else {
    notes.push(`Resultado de buscar_paciente (consulta anterior): ${previousLookup}`);
  }

  return { systemNote: notes.join("\n"), toolExecutions };
}
