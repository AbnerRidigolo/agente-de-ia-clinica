export const config = {
  port: Number(process.env.PORT ?? 3001),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.AGENT_MODEL ?? "claude-opus-4-8",
  dbPath: process.env.DB_PATH ?? "data/clinica.db",
  /** Sem API key o servidor sobe em modo demo (agente simulado, painel funcional). */
  get mockMode(): boolean {
    return !this.anthropicApiKey;
  },
};
