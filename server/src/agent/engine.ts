import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { db } from "../db.js";
import { buildSystemPrompt } from "./prompt.js";
import { toolDefinitions, executeTool } from "./tools.js";
import { checkInput, checkOutput, maskPII } from "./guardrails.js";
import { mockReply } from "./mock.js";
import { runPreflightContext } from "./context.js";
import { fallbackDecisionTree } from "./fallback.js";

const client = config.mockMode
  ? null
  : new OpenAI({
      apiKey: config.openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": config.openrouterSiteUrl,
        "X-Title": config.openrouterAppName,
      },
    });

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

function loadHistory(conversationId: number): ChatCompletionMessageParam[] {
  const rows = db
    .prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user','assistant') ORDER BY id"
    )
    .all(conversationId) as unknown as MessageRow[];
  return rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));
}

function saveMessage(
  conversationId: number,
  role: string,
  content: string,
  toolName: string | null = null,
  latencyMs: number | null = null,
  mode: "llm" | "fallback" = "llm",
  intent: string | null = null
): void {
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content, tool_name, latency_ms, mode, intent) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(conversationId, role, maskPII(content), toolName, latencyMs, mode, intent);
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

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    ...loadHistory(conversationId),
  ];
  const toolsUsed: string[] = [];
  let escalated = false;
  let finalText = "";

  const preflight = runPreflightContext(conversationId, userText);
  if (preflight) {
    messages.push({
      role: "system",
      content: `[Contexto automático — não repetir ao paciente]\n${preflight.systemNote}`,
    });
    for (const exec of preflight.toolExecutions) {
      toolsUsed.push(exec.name);
      if (exec.intent) setIntent(conversationId, exec.intent);
      saveMessage(conversationId, "tool", exec.result, exec.name);
    }
  }

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await client!.chat.completions.create({
        model: config.model,
        max_tokens: config.maxTokens,
        tools: toolDefinitions,
        messages,
      }, {
        timeout: 20000 // 20 seconds timeout as requested
      });

      const choice = response.choices[0]?.message;
      if (!choice) break;

      if (choice.tool_calls?.length) {
        messages.push(choice);

        for (const toolCall of choice.tool_calls) {
          if (toolCall.type !== "function") continue;
          const name = toolCall.function.name;
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
          } catch {
            input = {};
          }

          toolsUsed.push(name);
          const outcome = executeTool(name, input, conversationId);
          if (outcome.escalated) escalated = true;
          if (outcome.intent) setIntent(conversationId, outcome.intent);
          saveMessage(conversationId, "tool", outcome.result, name);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: outcome.result,
          });
        }
        continue;
      }

      finalText = (choice.content ?? "").trim();
      break;
    }

    if (!finalText) {
      throw new Error("Resposta vazia da OpenRouter");
    }

    // Camada determinística depois do modelo
    const outputCheck = checkOutput(finalText, conversationId);
    if (!outputCheck.allowed) finalText = outputCheck.cannedResponse!;

    const latencyMs = Date.now() - started;
    saveMessage(conversationId, "assistant", finalText, null, latencyMs, "llm");

    return { conversationId, reply: finalText, escalated, toolsUsed, latencyMs, mock: false, mode: "llm" } as any;

  } catch (err) {
    console.error("[engine] Erro na OpenRouter, executando fallback local:", err);
    
    const fallbackResult = fallbackDecisionTree(userText, conversationId);
    
    if (fallbackResult.needs_handoff) {
      db.prepare("UPDATE conversations SET status = 'escalada' WHERE id = ?").run(conversationId);
      escalated = true;
    }
    
    const latencyMs = Date.now() - started;
    saveMessage(conversationId, "assistant", fallbackResult.reply, null, latencyMs, "fallback", fallbackResult.intent);
    
    return {
      conversationId,
      reply: fallbackResult.reply,
      escalated,
      toolsUsed,
      latencyMs,
      mock: false,
      mode: "fallback",
      intent: fallbackResult.intent
    } as any;
  }
}
