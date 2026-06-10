import { Router } from "express";
import { z } from "zod";
import { createConversation, handleUserMessage } from "../agent/engine.js";
import { db } from "../db.js";

export const chatRouter = Router();

const chatSchema = z.object({
  conversationId: z.number().int().positive().optional(),
  message: z.string().min(1).max(4000),
});

chatRouter.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  }
  const { message } = parsed.data;
  let { conversationId } = parsed.data;

  try {
    if (!conversationId) conversationId = createConversation();
    const result = await handleUserMessage(conversationId, message);
    res.json(result);
  } catch (err) {
    console.error("[chat] erro:", err);
    const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : 500;
    const apiMessage =
      typeof err === "object" && err !== null && "error" in err
        ? (err as { error?: { message?: string } }).error?.message
        : undefined;
    let message = "Falha ao processar a mensagem. Tente novamente.";
    if (status === 402) {
      message =
        "Créditos insuficientes no OpenRouter. Adicione saldo em openrouter.ai/settings/credits ou use um modelo mais barato no .env.";
    } else if (status === 401) {
      message = "Chave da API OpenRouter inválida. Verifique OPENROUTER_API_KEY no .env.";
    } else if (status === 429) {
      message = "Limite de requisições atingido. Aguarde alguns segundos e tente de novo.";
    } else if (apiMessage) {
      message = apiMessage;
    }
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

const feedbackSchema = z.object({
  conversationId: z.number().int().positive(),
  csat: z.number().int().min(1).max(5),
  resolved: z.boolean().optional(),
});

chatRouter.post("/feedback", (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido" });
  const { conversationId, csat, resolved } = parsed.data;
  db.prepare("UPDATE conversations SET csat = ? WHERE id = ?").run(csat, conversationId);
  if (resolved) {
    db.prepare("UPDATE conversations SET status = 'resolvida' WHERE id = ? AND status = 'aberta'").run(conversationId);
  }
  res.json({ ok: true });
});
