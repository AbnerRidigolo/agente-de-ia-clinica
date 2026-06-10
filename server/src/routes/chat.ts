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
    res.status(500).json({ error: "Falha ao processar a mensagem" });
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
