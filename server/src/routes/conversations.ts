import { Router } from "express";
import { db } from "../db.js";

export const conversationsRouter = Router();

conversationsRouter.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const rows = status
    ? db.prepare(
        `SELECT id, channel, contact, status, intent, csat, created_at, updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conversations.id) AS message_count
         FROM conversations WHERE status = ? ORDER BY updated_at DESC LIMIT 100`
      ).all(status)
    : db.prepare(
        `SELECT id, channel, contact, status, intent, csat, created_at, updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conversations.id) AS message_count
         FROM conversations ORDER BY updated_at DESC LIMIT 100`
      ).all();
  res.json(rows);
});

conversationsRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const conversation = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as any;
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" });

  let phone = conversation.contact;
  if (phone && !/^\d+$/.test(phone)) {
    const patient = db.prepare("SELECT phone FROM patients WHERE name = ?").get(conversation.contact) as { phone: string } | undefined;
    if (patient) phone = patient.phone;
  }
  conversation.phone = phone;

  const messages = db
    .prepare("SELECT id, role, content, tool_name, latency_ms, created_at FROM messages WHERE conversation_id = ? ORDER BY id")
    .all(id);
  const guardrails = db
    .prepare("SELECT rule, detail, created_at FROM guardrail_events WHERE conversation_id = ? ORDER BY id")
    .all(id);
  res.json({ conversation, messages, guardrails });
});

conversationsRouter.post("/:id/resolve", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE conversations SET status = 'resolvida', updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ ok: true });
});
