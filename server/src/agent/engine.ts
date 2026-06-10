import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { db } from "../db.js";
import { buildSystemPrompt } from "./prompt.js";
import { toolDefinitions, executeTool } from "./tools.js";
import { checkInput, checkOutput, maskPII } from "./guardrails.js";
import { mockReply } from "./mock.js";

const client = config.mockMode ? null : new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_TOOL_ITERATIONS = 8;

export interface AgentReply {
  conversationId: number;
  reply: string;
  escalated: boolean;
  toolsUsed: string[];
  latencyMs: number;
  mock: boolean;
}

interface MessageRow {
  role: string;
  content: string;
}

export function createConversation(channel = "web", contact: string | null = null): number {
  db.prepare("INSERT INTO conversations (channel, contact) VALUES (?, ?)").run(channel, contact);
  const row = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
  return row.id;
}

function loadHistory(conversationId: number): Anthropic.MessageParam[] {
  const rows = db
    .prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user','assistant') ORDER BY id"
    )
    .all(conversationId) as unknown as MessageRow[];
  return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

function saveMessage(
  conversationId: number,
  role: string,
  content: string,
  toolName: string | null = null,
  latencyMs: number | null = null
): void {
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content, tool_name, latency_ms) VALUES (?, ?, ?, ?, ?)"
  ).run(conversationId, role, maskPII(content), toolName, latencyMs);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
}

function setIntent(conversationId: number, intent: string): void {
  db.prepare("UPDATE conversations SET intent = COALESCE(intent, ?) WHERE id = ?").run(intent, conversationId);
}

/**
 * Pipeline de uma mensagem do paciente:
 * guardrails de entrada → loop agêntico (modelo + tools) → guardrails de saída → persistência.
 */
export async function handleUserMessage(
  conversationId: number,
  userText: string
): Promise<AgentReply> {
  const started = Date.now();
  saveMessage(conversationId, "user", userText);

  // Camada determinística antes do modelo
  const inputCheck = checkInput(userText, conversationId);
  if (!inputCheck.allowed) {
    if (inputCheck.escalate) {
      db.prepare("UPDATE conversations SET status = 'escalada' WHERE id = ?").run(conversationId);
    }
    const reply = inputCheck.cannedResponse!;
    saveMessage(conversationId, "assistant", reply, null, Date.now() - started);
    return {
      conversationId,
      reply,
      escalated: Boolean(inputCheck.escalate),
      toolsUsed: [],
      latencyMs: Date.now() - started,
      mock: config.mockMode,
    };
  }

  if (config.mockMode) {
    const mock = mockReply(conversationId, userText);
    saveMessage(conversationId, "assistant", mock.reply, null, Date.now() - started);
    if (mock.intent) setIntent(conversationId, mock.intent);
    return {
      conversationId,
      reply: mock.reply,
      escalated: mock.escalated,
      toolsUsed: mock.toolsUsed,
      latencyMs: Date.now() - started,
      mock: true,
    };
  }

  const messages: Anthropic.MessageParam[] = loadHistory(conversationId);
  const toolsUsed: string[] = [];
  let escalated = false;
  let finalText = "";

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client!.messages.create({
      model: config.model,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: toolDefinitions,
      messages,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        toolsUsed.push(block.name);
        const outcome = executeTool(
          block.name,
          block.input as Record<string, unknown>,
          conversationId
        );
        if (outcome.escalated) escalated = true;
        if (outcome.intent) setIntent(conversationId, outcome.intent);
        saveMessage(conversationId, "tool", outcome.result, block.name);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: outcome.result,
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    break;
  }

  if (!finalText) {
    finalText =
      "Desculpe, tive um problema para concluir sua solicitação. Vou transferir você para um atendente humano.";
    escalated = true;
    db.prepare("UPDATE conversations SET status = 'escalada' WHERE id = ?").run(conversationId);
  }

  // Camada determinística depois do modelo
  const outputCheck = checkOutput(finalText, conversationId);
  if (!outputCheck.allowed) finalText = outputCheck.cannedResponse!;

  const latencyMs = Date.now() - started;
  saveMessage(conversationId, "assistant", finalText, null, latencyMs);

  return { conversationId, reply: finalText, escalated, toolsUsed, latencyMs, mock: false };
}
