import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { seedIfEmpty } from "./seed.js";
import { chatRouter } from "./routes/chat.js";
import { conversationsRouter } from "./routes/conversations.js";
import { metricsRouter } from "./routes/metrics.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { settingsRouter } from "./routes/settings.js";
import { crmRouter } from "./routes/crm.js";

seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mockMode: config.mockMode, model: config.model });
});

app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/metrics", metricsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/crm", crmRouter);

// Em produção (VPS/Docker), o mesmo processo serve o painel buildado (web/dist)
const webDist = path.resolve(import.meta.dirname, "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`[server] http://localhost:${config.port}`);
  if (existsSync(webDist)) console.log("[server] Painel sendo servido em / (web/dist)");
  if (config.mockMode) {
    console.log(
      "[server] OPENROUTER_API_KEY ausente — rodando em MODO DEMO (agente simulado). Configure a chave no .env para ativar o agente completo."
    );
  } else {
    console.log(`[server] Agente ativo com modelo ${config.model}.`);
  }
});
