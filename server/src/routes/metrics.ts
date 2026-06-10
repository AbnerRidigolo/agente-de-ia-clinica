import { Router } from "express";
import { db } from "../db.js";

export const metricsRouter = Router();

/**
 * Métricas de operação no padrão de agentes de atendimento:
 * volume, taxa de resolução automática (deflection), escalonamentos,
 * CSAT médio, latência média e quebra por intenção.
 */
metricsRouter.get("/", (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'resolvida' THEN 1 ELSE 0 END) AS resolved,
         SUM(CASE WHEN status = 'escalada' THEN 1 ELSE 0 END) AS escalated,
         SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END) AS open,
         AVG(csat) AS avg_csat
       FROM conversations`
    )
    .get() as { total: number; resolved: number; escalated: number; open: number; avg_csat: number | null };

  const latency = db
    .prepare("SELECT AVG(latency_ms) AS avg_latency FROM messages WHERE role = 'assistant' AND latency_ms IS NOT NULL")
    .get() as { avg_latency: number | null };

  const byIntent = db
    .prepare(
      `SELECT COALESCE(intent, 'outros') AS intent, COUNT(*) AS count
       FROM conversations GROUP BY COALESCE(intent, 'outros') ORDER BY count DESC`
    )
    .all();

  const byDay = db
    .prepare(
      `SELECT date(created_at) AS day,
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'escalada' THEN 1 ELSE 0 END) AS escalated
       FROM conversations
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY date(created_at) ORDER BY day`
    )
    .all();

  const guardrails = db
    .prepare(
      `SELECT rule, COUNT(*) AS count FROM guardrail_events GROUP BY rule ORDER BY count DESC`
    )
    .all();

  const funnelLeads = (db.prepare("SELECT COUNT(*) AS n FROM conversations").get() as { n: number }).n;
  const funnelQualified = (db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE intent IS NOT NULL AND intent != 'convenio'").get() as { n: number }).n;
  const funnelScheduled = (db.prepare("SELECT COUNT(*) AS n FROM appointments").get() as { n: number }).n;
  const funnelConfirmed = (db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE status IN ('confirmada', 'realizada')").get() as { n: number }).n;

  const closedCount = totals.resolved + totals.escalated;
  res.json({
    totalConversations: totals.total,
    resolved: totals.resolved,
    escalated: totals.escalated,
    open: totals.open,
    deflectionRate: closedCount > 0 ? totals.resolved / closedCount : null,
    avgCsat: totals.avg_csat,
    avgLatencyMs: latency.avg_latency,
    byIntent,
    byDay,
    guardrails,
    funnel: {
      leads: funnelLeads,
      qualified: funnelQualified,
      scheduled: funnelScheduled,
      confirmed: funnelConfirmed,
    },
  });
});
