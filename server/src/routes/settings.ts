import { Router } from "express";
import { z } from "zod";
import { getAops, getPersona, saveAops, savePersona, DEFAULT_AOPS, DEFAULT_PERSONA } from "../agent/aops.js";
import { config } from "../config.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json({
    persona: getPersona(),
    aops: getAops(),
    model: config.model,
    mockMode: config.mockMode,
  });
});

const updateSchema = z.object({
  persona: z.string().min(10).max(5000).optional(),
  aops: z.string().min(10).max(50000).optional(),
});

settingsRouter.put("/", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido" });
  if (parsed.data.persona) savePersona(parsed.data.persona);
  if (parsed.data.aops) saveAops(parsed.data.aops);
  res.json({ ok: true });
});

settingsRouter.post("/reset", (_req, res) => {
  savePersona(DEFAULT_PERSONA);
  saveAops(DEFAULT_AOPS);
  res.json({ ok: true });
});
