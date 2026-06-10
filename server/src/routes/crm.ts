import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";

export const crmRouter = Router();

const STAGES = ["novo", "lead", "ativo", "vip", "inativo"] as const;

/**
 * CRM alimentado automaticamente pelo agente: todo paciente criado em um
 * agendamento vira cliente aqui, com histórico de consultas, conversas e
 * anotações da equipe.
 */
crmRouter.get("/clients", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const stage = typeof req.query.stage === "string" ? req.query.stage : "";

  let sql = `
    SELECT p.id, p.name, p.phone, p.email, p.birth_date, p.insurance, p.stage, p.notes, p.created_at,
      (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) AS total_appointments,
      (SELECT MIN(a.starts_at) FROM appointments a
        WHERE a.patient_id = p.id AND a.status = 'confirmada' AND a.starts_at > datetime('now')) AS next_appointment,
      (SELECT MAX(x.created_at) FROM (
        SELECT created_at FROM crm_interactions i WHERE i.patient_id = p.id
        UNION ALL
        SELECT created_at FROM appointments a WHERE a.patient_id = p.id
      ) x) AS last_activity
    FROM patients p`;
  const where: string[] = [];
  const params: string[] = [];
  if (search) {
    where.push("(p.name LIKE ? OR p.phone LIKE ? OR COALESCE(p.email,'') LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (stage && (STAGES as readonly string[]).includes(stage)) {
    where.push("p.stage = ?");
    params.push(stage);
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY last_activity DESC NULLS LAST, p.created_at DESC LIMIT 300";

  res.json(db.prepare(sql).all(...params));
});

crmRouter.get("/clients/:id", (req, res) => {
  const id = Number(req.params.id);
  const client = db.prepare("SELECT * FROM patients WHERE id = ?").get(id) as
    | { phone: string; name: string }
    | undefined;
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  const appointments = db
    .prepare(
      "SELECT id, specialty, professional, starts_at, status FROM appointments WHERE patient_id = ? ORDER BY starts_at DESC"
    )
    .all(id);
  const interactions = db
    .prepare("SELECT id, type, content, created_at FROM crm_interactions WHERE patient_id = ? ORDER BY id DESC")
    .all(id);
  const conversations = db
    .prepare(
      "SELECT id, status, intent, csat, updated_at FROM conversations WHERE contact = ? OR contact = ? ORDER BY updated_at DESC LIMIT 20"
    )
    .all(client.phone, client.name);

  res.json({ client, appointments, interactions, conversations });
});

const clientSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email().nullish().or(z.literal("")),
  birth_date: z.string().max(10).nullish().or(z.literal("")),
  insurance: z.string().max(60).nullish().or(z.literal("")),
  stage: z.enum(STAGES).optional(),
  notes: z.string().max(5000).nullish().or(z.literal("")),
});

crmRouter.post("/clients", (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
  const d = parsed.data;
  const phone = d.phone.replace(/\D/g, "");
  const exists = db.prepare("SELECT id FROM patients WHERE phone = ?").get(phone);
  if (exists) return res.status(409).json({ error: "Já existe um cliente com este telefone" });
  db.prepare(
    "INSERT INTO patients (name, phone, email, birth_date, insurance, stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(d.name, phone, d.email || null, d.birth_date || null, d.insurance || null, d.stage ?? "lead", d.notes || null);
  const row = db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number };
  db.prepare("INSERT INTO crm_interactions (patient_id, type, content) VALUES (?, 'sistema', 'Cliente cadastrado manualmente pelo painel')").run(row.id);
  res.status(201).json({ id: row.id });
});

crmRouter.put("/clients/:id", (req, res) => {
  const id = Number(req.params.id);
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido" });
  const exists = db.prepare("SELECT id FROM patients WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Cliente não encontrado" });

  const d = parsed.data;
  const sets: string[] = [];
  const params: (string | null)[] = [];
  const push = (col: string, val: string | null | undefined) => {
    if (val === undefined) return;
    sets.push(`${col} = ?`);
    params.push(val === "" ? null : val);
  };
  push("name", d.name);
  push("phone", d.phone ? d.phone.replace(/\D/g, "") : undefined);
  push("email", d.email as string | null | undefined);
  push("birth_date", d.birth_date as string | null | undefined);
  push("insurance", d.insurance as string | null | undefined);
  push("stage", d.stage);
  push("notes", d.notes as string | null | undefined);
  if (sets.length === 0) return res.json({ ok: true });

  db.prepare(`UPDATE patients SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  if (d.stage) {
    db.prepare(
      "INSERT INTO crm_interactions (patient_id, type, content) VALUES (?, 'sistema', ?)"
    ).run(id, `Estágio alterado para "${d.stage}"`);
  }
  res.json({ ok: true });
});

const noteSchema = z.object({ content: z.string().min(1).max(5000) });

crmRouter.post("/clients/:id/notes", (req, res) => {
  const id = Number(req.params.id);
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido" });
  const exists = db.prepare("SELECT id FROM patients WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Cliente não encontrado" });
  db.prepare("INSERT INTO crm_interactions (patient_id, type, content) VALUES (?, 'nota', ?)").run(
    id,
    parsed.data.content
  );
  res.status(201).json({ ok: true });
});
