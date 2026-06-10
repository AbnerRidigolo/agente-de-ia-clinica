export const config = {
  port: Number(process.env.PORT ?? 3001),
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: process.env.AGENT_MODEL ?? "openai/gpt-oss-120b:free",
  maxTokens: Number(process.env.AGENT_MAX_TOKENS ?? 512),
  openrouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "http://localhost:5173",
  openrouterAppName: process.env.OPENROUTER_APP_NAME ?? "Agente Clinica Sofia",
  dbPath: process.env.DB_PATH ?? "data/clinica.db",
  /** Sem API key o servidor sobe em modo demo (agente simulado, painel funcional). */
  get mockMode(): boolean {
    return !this.openrouterApiKey;
  },
};
