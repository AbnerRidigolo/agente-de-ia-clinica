import { executeTool } from "./tools.js";

export interface MockResult {
  reply: string;
  escalated: boolean;
  toolsUsed: string[];
  intent?: string;
}

/**
 * Agente simulado para modo demo (sem OPENROUTER_API_KEY).
 * Roteia por intenção com regras simples e usa as MESMAS ferramentas do
 * agente real, para que o painel e os fluxos funcionem de ponta a ponta.
 */
export function mockReply(conversationId: number, text: string): MockResult {
  const t = text.toLowerCase();

  if (/(falar com|quero um|atendente|humano|pessoa de verdade)/.test(t)) {
    const r = executeTool("escalar_para_humano", { motivo: "pedido explícito do paciente" }, conversationId);
    return {
      reply:
        "Claro! Estou transferindo você para um atendente humano. O tempo médio de espera é de 5 minutos. 😊",
      escalated: true,
      toolsUsed: ["escalar_para_humano"],
      intent: r.intent,
    };
  }

  if (/(agendar|marcar|consulta|hor[áa]rio)/.test(t)) {
    let spec = "Avaliação Facial";
    if (/(harmoniz|completa)/.test(t)) spec = "Harmonização Facial";
    else if (/(toxina|botox)/.test(t)) spec = "Toxina Botulínica";
    else if (/preenchi/.test(t)) spec = "Preenchimento";
    else if (/(bioestimula|colageno)/.test(t)) spec = "Bioestimuladores de Colágeno";
    else if (/skinbooster/.test(t)) spec = "Skinbooster";
    else if (/avalia/.test(t)) spec = "Avaliação Facial";

    const outcome = executeTool("buscar_horarios", { especialidade: spec }, conversationId);
    const data = JSON.parse(outcome.result) as {
      horarios: { slot_id: number; profissional: string; data_hora: string }[];
      aviso?: string;
    };
    if (!data.horarios?.length) {
      return {
        reply: `No momento não encontrei horários para essa especialidade/procedimento. ${data.aviso ?? ""}`,
        escalated: false,
        toolsUsed: ["buscar_horarios"],
        intent: "agendamento",
      };
    }
    const lista = data.horarios
      .slice(0, 3)
      .map((h, i) => `${i + 1}. ${h.data_hora} — ${h.profissional}`)
      .join("\n");
    return {
      reply: `Encontrei estes horários disponíveis:\n${lista}\n\nQual prefere? Para confirmar, me informe também seu nome completo e telefone com DDD. (modo demonstração — configure OPENROUTER_API_KEY para o agente completo)`,
      escalated: false,
      toolsUsed: ["buscar_horarios"],
      intent: "agendamento",
    };
  }

  if (/(cancelar|desmarcar|remarcar|reagendar)/.test(t)) {
    return {
      reply:
        "Posso ajudar com isso! Me informe o telefone com DDD usado no cadastro para eu localizar sua consulta ou avaliação.",
      escalated: false,
      toolsUsed: [],
      intent: "cancelamento",
    };
  }

  if (/(conv[êe]nio|plano de sa[úu]de|unimed|amil|bradesco|sulam[ée]rica|cobertura)/.test(t)) {
    return {
      reply: "A clínica da Dra. Daniela Morais atende exclusivamente de forma particular. Se quiser, posso ajudar a agendar uma avaliação facial para você! 😊",
      escalated: false,
      toolsUsed: ["consultar_convenios"],
      intent: "convenio",
    };
  }

  if (/(endere[çc]o|onde fica|hor[áa]rio de funcionamento|estacionamento|valor|pre[çc]o|pagamento)/.test(t)) {
    const outcome = executeTool("base_conhecimento", { topico: t }, conversationId);
    const data = JSON.parse(outcome.result) as {
      resultados?: { content: string }[];
      encontrado?: boolean;
    };
    const reply = data.resultados?.length
      ? data.resultados[0].content
      : "Não encontrei essa informação na base de conhecimento. Quer falar com um atendente humano?";
    return { reply, escalated: false, toolsUsed: ["base_conhecimento"], intent: "duvida_geral" };
  }

  return {
    reply:
      "Olá! Sou a Sofia, assistente virtual da clínica da Dra. Daniela Morais. Posso ajudar com agendamento de avaliações, informações de procedimentos e dúvidas gerais. Como posso ajudar? 😊",
    escalated: false,
    toolsUsed: [],
  };
}
