import { db } from "../db.js";
import { checkInput } from "./guardrails.js";

export interface FallbackResponse {
  reply: string;
  mode: "fallback";
  intent: string;
  needs_handoff: boolean;
}

const VARIATIONS: Record<string, string[]> = {
  agendamento_inicio: [
    "Olá! Claro, vamos agendar uma avaliação facial com a Dra. Daniela Morais. Para facilitar para você, qual período do dia prefere: manhã, tarde ou noite? ✨",
    "Oi! Com certeza, a Dra. Daniela fará uma avaliação completa para entender o seu caso. Você tem preferência por qual período do dia (manhã, tarde ou noite)? 😊"
  ],
  agendamento_confirmacao: [
    "Excelente! Registrei sua preferência. Nossa equipe de recepção entrará em contato em instantes por este canal para confirmar o horário exato com você. ✨",
    "Perfeito! Já passei sua preferência para nossa equipe. Um de nossos atendentes entrará em contato por aqui para finalizar o horário exato da sua avaliação. 😊"
  ],
  valores: [
    "Como os tratamentos de harmonização e toxina botulínica são muito personalizados, os valores finais dependem da quantidade necessária e do planejamento feito em consulta. A nossa avaliação inicial fica a partir de R$ 150. Quer marcar seu horário? 😊",
    "Os valores dos procedimentos variam de acordo com as áreas e as proporções do seu rosto. Em uma avaliação presencial, a Dra. Daniela elabora o seu orçamento ideal. Que tal agendarmos essa primeira conversa? ✨"
  ],
  endereco: [
    "Nós ficamos na Avenida Paulista, 2000, conjunto 1205 (próximo ao Metrô Consolação), em São Paulo. Atendemos de segunda a sexta das 9h às 19h e aos sábados das 9h às 13h. Aguardamos sua visita! ✨",
    "Nosso consultório está localizado em São Paulo, na Av. Paulista, 2000, cj. 1205 (pertinho do Metrô Consolação). O atendimento é de segunda a sexta das 9h às 19h, e aos sábados das 9h às 13h. 😊"
  ],
  human_handoff: [
    "Com certeza! Vou passar seu chat para nossa equipe agora mesmo. Em poucos minutos um de nossos profissionais continuará falando com você. Só um momento. 😊",
    "Claro, sem problemas! Estou transferindo seu atendimento para a nossa equipe. Alguém retornará por aqui em instantes. Obrigado pela paciência! ✨"
  ],
  default: [
    "Olá! Sou a Sofia, assistente virtual da clínica da Dra. Daniela Morais. No momento, estou com dificuldade de conexão, mas posso te ajudar com dúvidas simples de endereço, horários, valores gerais ou transferir para um humano. Como posso te ajudar? 😊",
    "Oi, aqui é a Sofia! Minha conexão com o sistema principal está instável no momento, mas consigo te passar informações de endereço, valores iniciais, agendamento de avaliação ou te transferir para falar com nossa equipe. O que você precisa? ✨"
  ]
};

function getRandomVariation(key: string): string {
  const list = VARIATIONS[key] || VARIATIONS.default;
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

interface MessageRow {
  content: string;
  intent: string | null;
}

function getPreviousAssistantMessage(conversationId: number): MessageRow | null {
  const row = db
    .prepare(
      "SELECT content, intent FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1"
    )
    .get(conversationId) as MessageRow | undefined;
  return row ?? null;
}

/**
 * Árvore de decisão para processar mensagens de fallback local.
 */
export function fallbackDecisionTree(message: string, conversationId: number): FallbackResponse {
  // 1. Guardrail de entrada por segurança (caso o fluxo pule direto para o fallback)
  const inputCheck = checkInput(message, conversationId);
  if (!inputCheck.allowed) {
    return {
      reply: inputCheck.cannedResponse!,
      mode: "fallback",
      intent: "urgencia_detectada",
      needs_handoff: true
    };
  }

  const text = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  // 2. Rastrear se estamos no passo 2 do fluxo de agendamento
  const prevMsg = getPreviousAssistantMessage(conversationId);
  const isInAgendamentoFlow =
    prevMsg?.intent === "agendamento_avaliacao" &&
    (prevMsg.content.includes("período") || prevMsg.content.includes("periodo"));

  if (isInAgendamentoFlow) {
    return {
      reply: getRandomVariation("agendamento_confirmacao"),
      mode: "fallback",
      intent: "agendamento_avaliacao",
      needs_handoff: true
    };
  }

  // 3. Classificar intenção por regex/palavras-chave
  let intent = "duvida_geral";
  let reply = "";
  let needs_handoff = false;

  if (/(agendar|marcar|avaliacao|procedimento|consulta|horario|botox|preenchimento|colageno|harmonizacao|skinbooster)/.test(text)) {
    intent = "agendamento_avaliacao";
    reply = getRandomVariation("agendamento_inicio");
  } else if (/(preco|valor|quanto|custa|orcamento|paga|parcela|pix|cartao)/.test(text)) {
    intent = "preco_valores";
    reply = getRandomVariation("valores");
  } else if (/(onde|fica|endereco|localizacao|mapa|chegar|funcionamento|atend|sabado)/.test(text)) {
    intent = "endereco_horario";
    reply = getRandomVariation("endereco");
  } else if (/(atendente|humano|pessoa|falar com|ajuda|suporte|contato|ligar|telefone|whatsapp)/.test(text)) {
    intent = "falar_com_humano";
    reply = getRandomVariation("human_handoff");
    needs_handoff = true;
  } else {
    reply = getRandomVariation("default");
  }

  return {
    reply,
    mode: "fallback",
    intent,
    needs_handoff
  };
}
