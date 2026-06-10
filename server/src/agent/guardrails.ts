import { db } from "../db.js";

export interface GuardrailResult {
  allowed: boolean;
  /** Resposta fixa a devolver quando o guardrail bloqueia o fluxo normal. */
  cannedResponse?: string;
  /** Sinaliza que a conversa deve ser escalada para humano. */
  escalate?: boolean;
  rule?: string;
}

const EMERGENCY_PATTERNS =
  /\b(infart|avc|derrame|desmai|convuls|sangrament|overdose|suicid|me matar|não consigo respirar|nao consigo respirar|dor no peito|engasg)\w*/i;

const PROMPT_INJECTION_PATTERNS =
  /(ignore (as|suas|todas as) instru|esqueça (as|suas) instru|system prompt|jailbreak|finja que você não é|revele suas instru|mostre seu prompt)/i;

/**
 * Guardrails de entrada — rodam ANTES do modelo (padrão Decagon: camada
 * determinística fora do LLM). Emergências e injeção de prompt nunca chegam
 * ao fluxo normal do agente.
 */
export function checkInput(text: string, conversationId: number): GuardrailResult {
  if (EMERGENCY_PATTERNS.test(text)) {
    logEvent(conversationId, "emergencia_detectada", text.slice(0, 200));
    return {
      allowed: false,
      escalate: true,
      rule: "emergencia_detectada",
      cannedResponse:
        "⚠️ Se isso é uma emergência médica, ligue AGORA para o SAMU: 192. " +
        "Estou transferindo você imediatamente para um atendente humano da clínica. " +
        "Por favor, não espere pela nossa resposta se os sintomas forem graves.",
    };
  }

  if (PROMPT_INJECTION_PATTERNS.test(text)) {
    logEvent(conversationId, "tentativa_injecao", text.slice(0, 200));
    return {
      allowed: false,
      rule: "tentativa_injecao",
      cannedResponse:
        "Posso ajudar com agendamentos, cancelamentos e informações da clínica da Dra. Daniela Morais. Como posso ajudar? 😊",
    };
  }

  return { allowed: true };
}

const MEDICAL_ADVICE_PATTERNS =
  /\b(o diagnóstico é|você (provavelmente )?(tem|está com)|recomendo tomar|a dose (correta|ideal)|pode tomar \d|sugiro o medicamento)\b/i;

/**
 * Guardrails de saída — rodam DEPOIS do modelo. Se a resposta parecer
 * aconselhamento médico/diagnóstico, é substituída por uma resposta segura.
 */
export function checkOutput(text: string, conversationId: number): GuardrailResult {
  if (MEDICAL_ADVICE_PATTERNS.test(text)) {
    logEvent(conversationId, "conselho_medico_bloqueado", text.slice(0, 200));
    return {
      allowed: false,
      rule: "conselho_medico_bloqueado",
      cannedResponse:
        "Sobre questões clínicas, quem pode orientar com segurança é um dos nossos profissionais. " +
        "Quer que eu agende uma consulta para você conversar com um médico?",
    };
  }
  return { allowed: true };
}

/** Mascara CPFs e cartões em logs/transcrições (LGPD). */
export function maskPII(text: string): string {
  return text
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**")
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "**** **** **** ****");
}

function logEvent(conversationId: number, rule: string, detail: string): void {
  db.prepare(
    "INSERT INTO guardrail_events (conversation_id, rule, detail) VALUES (?, ?, ?)"
  ).run(conversationId, rule, maskPII(detail));
}
