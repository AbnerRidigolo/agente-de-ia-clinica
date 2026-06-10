import { Router } from "express";
import { db } from "../db.js";

export const appointmentsRouter = Router();

appointmentsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id, p.name AS patient, p.phone, p.insurance, a.specialty, a.professional, a.starts_at, a.status
       FROM appointments a JOIN patients p ON p.id = a.patient_id
       ORDER BY a.starts_at DESC LIMIT 200`
    )
    .all();
  res.json(rows);
});
