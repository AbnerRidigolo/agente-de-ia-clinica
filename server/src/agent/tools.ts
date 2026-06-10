import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { db } from "../db.js";

/**
 * Ferramentas do agente (tool use). Cada tool tem descrição prescritiva de
 * QUANDO ser chamada — isso aumenta a taxa de acerto do modelo na decisão de uso.
 */
export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "buscar_horarios",
      description:
        "Busca horários de consulta disponíveis. Chame SEMPRE que o paciente quiser agendar ou reagendar, antes de oferecer qualquer horário. Nunca invente horários.",
      parameters: {
      type: "object",
      properties: {
        especialidade: {
          type: "string",
          description:
            "Especialidade desejada, ex.: clinica geral, cardiologia, dermatologia, pediatria, ginecologia, ortopedia",
        },
      },
        required: ["especialidade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_paciente",
      description:
        "Localiza o cadastro do paciente e suas consultas futuras pelo telefone. Chame antes de cancelar/reagendar e para verificar se o paciente já tem cadastro.",
      parameters: {
      type: "object",
      properties: {
        telefone: { type: "string", description: "Telefone com DDD, apenas números" },
      },
        required: ["telefone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_consulta",
      description:
        "Efetiva o agendamento de uma consulta em um horário retornado por buscar_horarios. Chame SOMENTE após o paciente confirmar explicitamente o horário e informar nome completo e telefone.",
      parameters: {
      type: "object",
      properties: {
        slot_id: { type: "integer", description: "ID do horário escolhido (vindo de buscar_horarios)" },
        nome: { type: "string", description: "Nome completo do paciente" },
        telefone: { type: "string", description: "Telefone com DDD, apenas números" },
        convenio: { type: "string", description: "Nome do convênio, ou 'particular'" },
      },
        required: ["slot_id", "nome", "telefone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_consulta",
      description:
        "Cancela uma consulta existente. Chame SOMENTE após confirmar com o paciente qual consulta (retornada por buscar_paciente) será cancelada.",
      parameters: {
      type: "object",
      properties: {
        consulta_id: { type: "integer", description: "ID da consulta (vindo de buscar_paciente)" },
      },
        required: ["consulta_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_convenios",
      description:
        "Lista os convênios aceitos pela clínica e as especialidades cobertas. Chame quando o paciente perguntar sobre plano de saúde, cobertura ou convênio.",
      parameters: {
      type: "object",
      properties: {
        convenio: {
          type: "string",
          description: "Nome do convênio a verificar (opcional; vazio lista todos)",
        },
      },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "base_conhecimento",
      description:
        "Consulta a base de conhecimento da clínica (endereço, horários de funcionamento, valores particulares, preparo de exames, estacionamento, formas de pagamento). Chame antes de responder qualquer pergunta institucional — nunca responda de memória.",
      parameters: {
      type: "object",
      properties: {
        topico: { type: "string", description: "Tópico ou palavras-chave da dúvida" },
      },
        required: ["topico"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_para_humano",
      description:
        "Transfere a conversa para um atendente humano. Chame nas situações do AOP-04: urgência médica, pedido explícito do paciente, reclamação/reembolso, suspeita de erro, ou quando você não conseguir resolver após 2 tentativas.",
      parameters: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo resumido do escalonamento" },
      },
        required: ["motivo"],
      },
    },
  },
];

interface SlotRow {
  id: number;
  specialty: string;
  professional: string;
  starts_at: string;
}

export interface ToolOutcome {
  result: string;
  escalated?: boolean;
  intent?: string;
}

/** Executa uma tool chamada pelo modelo e devolve o resultado como string JSON/texto. */
export function executeTool(
  name: string,
  input: Record<string, unknown>,
  conversationId: number
): ToolOutcome {
  switch (name) {
    case "buscar_horarios": {
      // Normaliza acentos e flexões ("cardiologista" → casa com "Cardiologia")
      const normalize = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
      const term = normalize(String(input.especialidade ?? ""));
      const stem = term.slice(0, 6);
      const all = db
        .prepare(
          `SELECT id, specialty, professional, starts_at FROM slots
           WHERE taken = 0 AND starts_at > datetime('now')
           ORDER BY starts_at`
        )
        .all() as unknown as SlotRow[];
      const rows = all
        .filter((r) => {
          const spec = normalize(r.specialty);
          return spec.includes(stem) || term.includes(spec.slice(0, 6));
        })
        .slice(0, 5);
      if (rows.length === 0) {
        const specs = db
          .prepare("SELECT DISTINCT specialty FROM slots WHERE taken = 0")
          .all() as unknown as { specialty: string }[];
        return {
          intent: "agendamento",
          result: JSON.stringify({
            horarios: [],
            aviso: `Sem horários para "${term}". Especialidades com agenda aberta: ${specs.map((s) => s.specialty).join(", ")}`,
          }),
        };
      }
      return {
        intent: "agendamento",
        result: JSON.stringify({
          horarios: rows.map((r) => ({
            slot_id: r.id,
            especialidade: r.specialty,
            profissional: r.professional,
            data_hora: r.starts_at,
          })),
        }),
      };
    }

    case "buscar_paciente": {
      const phone = String(input.telefone ?? "").replace(/\D/g, "");
      const patient = db
        .prepare("SELECT id, name, phone, insurance FROM patients WHERE phone = ?")
        .get(phone) as { id: number; name: string; phone: string; insurance: string | null } | undefined;
      if (!patient) {
        return { result: JSON.stringify({ encontrado: false, aviso: "Paciente não cadastrado. O cadastro será criado automaticamente no agendamento." }) };
      }
      const appts = db
        .prepare(
          `SELECT id, specialty, professional, starts_at, status FROM appointments
           WHERE patient_id = ? AND status = 'confirmada' AND starts_at > datetime('now')
           ORDER BY starts_at`
        )
        .all(patient.id) as unknown as {
        id: number; specialty: string; professional: string; starts_at: string; status: string;
      }[];
      return {
        result: JSON.stringify({
          encontrado: true,
          paciente: { nome: patient.name, convenio: patient.insurance ?? "particular" },
          consultas_futuras: appts.map((a) => ({
            consulta_id: a.id,
            especialidade: a.specialty,
            profissional: a.professional,
            data_hora: a.starts_at,
          })),
        }),
      };
    }

    case "agendar_consulta": {
      const slotId = Number(input.slot_id);
      const phone = String(input.telefone ?? "").replace(/\D/g, "");
      const nome = String(input.nome ?? "").trim();
      const convenio = String(input.convenio ?? "particular");

      const slot = db
        .prepare("SELECT id, specialty, professional, starts_at FROM slots WHERE id = ? AND taken = 0")
        .get(slotId) as SlotRow | undefined;
      if (!slot) {
        return { result: JSON.stringify({ sucesso: false, erro: "Horário indisponível ou inexistente. Busque os horários novamente." }) };
      }

      let patient = db.prepare("SELECT id FROM patients WHERE phone = ?").get(phone) as { id: number } | undefined;
      if (!patient) {
        db.prepare("INSERT INTO patients (name, phone, insurance) VALUES (?, ?, ?)").run(nome, phone, convenio);
        patient = db.prepare("SELECT id FROM patients WHERE phone = ?").get(phone) as { id: number };
      }

      db.prepare("UPDATE slots SET taken = 1 WHERE id = ?").run(slotId);
      db.prepare(
        "INSERT INTO appointments (patient_id, specialty, professional, starts_at) VALUES (?, ?, ?, ?)"
      ).run(patient.id, slot.specialty, slot.professional, slot.starts_at);

      // Alimenta o CRM: cliente vira "ativo" e ganha registro na linha do tempo
      db.prepare("UPDATE patients SET stage = 'ativo' WHERE id = ? AND stage IN ('novo','lead','inativo')").run(patient.id);
      db.prepare(
        "INSERT INTO crm_interactions (patient_id, type, content) VALUES (?, 'sistema', ?)"
      ).run(patient.id, `Consulta de ${slot.specialty} agendada pelo agente para ${slot.starts_at}`);

      return {
        intent: "agendamento",
        result: JSON.stringify({
          sucesso: true,
          consulta: {
            especialidade: slot.specialty,
            profissional: slot.professional,
            data_hora: slot.starts_at,
          },
        }),
      };
    }

    case "cancelar_consulta": {
      const id = Number(input.consulta_id);
      const appt = db
        .prepare("SELECT id, status, patient_id, specialty, starts_at FROM appointments WHERE id = ?")
        .get(id) as { id: number; status: string; patient_id: number; specialty: string; starts_at: string } | undefined;
      if (!appt || appt.status !== "confirmada") {
        return { result: JSON.stringify({ sucesso: false, erro: "Consulta não encontrada ou já cancelada." }) };
      }
      db.prepare("UPDATE appointments SET status = 'cancelada' WHERE id = ?").run(id);
      db.prepare(
        "INSERT INTO crm_interactions (patient_id, type, content) VALUES (?, 'sistema', ?)"
      ).run(appt.patient_id, `Consulta de ${appt.specialty} (${appt.starts_at}) cancelada pelo agente`);
      return { intent: "cancelamento", result: JSON.stringify({ sucesso: true }) };
    }

    case "consultar_convenios": {
      const filtro = String(input.convenio ?? "").toLowerCase().trim();
      const row = db
        .prepare("SELECT content FROM knowledge_base WHERE topic = 'convenios'")
        .get() as { content: string } | undefined;
      const all = row ? (JSON.parse(row.content) as { nome: string; especialidades: string[] }[]) : [];
      const found = filtro ? all.filter((c) => c.nome.toLowerCase().includes(filtro)) : all;
      return {
        intent: "convenio",
        result: JSON.stringify(
          filtro && found.length === 0
            ? { aceito: false, convenios_aceitos: all.map((c) => c.nome) }
            : { convenios: found }
        ),
      };
    }

    case "base_conhecimento": {
      const topico = String(input.topico ?? "").toLowerCase();
      const rows = db
        .prepare("SELECT topic, content FROM knowledge_base WHERE topic != 'convenios'")
        .all() as unknown as { topic: string; content: string }[];
      const terms = topico.split(/\s+/).filter((t) => t.length > 2);
      const matches = rows.filter((r) =>
        terms.some((t) => r.topic.includes(t) || r.content.toLowerCase().includes(t))
      );
      if (matches.length === 0) {
        return {
          intent: "duvida_geral",
          result: JSON.stringify({
            encontrado: false,
            topicos_disponiveis: rows.map((r) => r.topic),
            instrucao: "Informação não disponível. Não invente a resposta; ofereça escalar para um atendente.",
          }),
        };
      }
      return {
        intent: "duvida_geral",
        result: JSON.stringify({ resultados: matches.slice(0, 3) }),
      };
    }

    case "escalar_para_humano": {
      const motivo = String(input.motivo ?? "não informado");
      db.prepare("UPDATE conversations SET status = 'escalada', updated_at = datetime('now') WHERE id = ?").run(conversationId);
      db.prepare(
        "INSERT INTO guardrail_events (conversation_id, rule, detail) VALUES (?, 'escalonamento', ?)"
      ).run(conversationId, motivo);
      return {
        escalated: true,
        intent: "escalonamento",
        result: JSON.stringify({
          sucesso: true,
          instrucao:
            "Conversa transferida para a fila humana. Informe ao paciente que um atendente assumirá em instantes e o tempo médio de espera é de 5 minutos.",
        }),
      };
    }

    default:
      return { result: JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` }) };
  }
}
