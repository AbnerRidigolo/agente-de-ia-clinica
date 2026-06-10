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
    .all() as any[];

  const appointments = rows.map((r) => {
    // Busca a última conversa do lead (pelo telefone ou nome)
    const conv = db
      .prepare(
        "SELECT id, intent FROM conversations WHERE contact = ? OR contact = ? ORDER BY id DESC LIMIT 1"
      )
      .get(r.phone, r.patient) as { id: number; intent: string | null } | undefined;

    let briefing = `Consulta de ${r.specialty}. Sem observações extraídas do chat.`;

    if (conv) {
      // Pega o histórico das mensagens enviadas pelo usuário
      const userMsgs = db
        .prepare("SELECT content FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY id")
        .all(conv.id) as { content: string }[];

      const textHistory = userMsgs.map((m) => m.content.toLowerCase()).join(" ");

      if (r.specialty.toLowerCase().includes("preenchimento")) {
        let area = "Face";
        if (textHistory.includes("labio") || textHistory.includes("boca")) area = "Lábios";
        else if (textHistory.includes("olheira")) area = "Olheiras";
        else if (textHistory.includes("mandibula") || textHistory.includes("queixo") || textHistory.includes("mento")) area = "Mandíbula/Queixo";
        
        briefing = `Interesse em Preenchimento de ${area}.`;
      } else if (r.specialty.toLowerCase().includes("toxina") || r.specialty.toLowerCase().includes("botox")) {
        let areaFoco = "";
        if (textHistory.includes("testa") || textHistory.includes("glabela") || textHistory.includes("olho") || textHistory.includes("rugas")) {
          areaFoco = " (linhas de expressão/testa)";
        }
        briefing = `Interesse em Toxina Botulínica${areaFoco}.`;
      } else if (r.specialty.toLowerCase().includes("harmonizacao")) {
        let estilo = "";
        if (textHistory.includes("natural") || textHistory.includes("sutil") || textHistory.includes("leve")) {
          estilo = " (busca resultado sutil/natural)";
        } else if (textHistory.includes("marcado") || textHistory.includes("volume") || textHistory.includes("definido")) {
          estilo = " (busca contornos bem marcados/definidos)";
        }
        briefing = `Interesse em Harmonização Facial completa${estilo}.`;
      } else if (r.specialty.toLowerCase().includes("bioestimulador") || r.specialty.toLowerCase().includes("colageno")) {
        let area = "";
        if (textHistory.includes("pescoço") || textHistory.includes("colo")) area = " em pescoço/colo";
        else if (textHistory.includes("mão") || textHistory.includes("maos")) area = " nas mãos";
        briefing = `Interesse em Bioestimulador de Colágeno${area} para flacidez.`;
      } else if (r.specialty.toLowerCase().includes("skinbooster")) {
        briefing = "Interesse em Skinbooster para hidratação profunda e viço.";
      } else if (r.specialty.toLowerCase().includes("avaliacao")) {
        let detalhe = "";
        if (textHistory.includes("primeira vez") || textHistory.includes("nunca fiz")) {
          detalhe = " (nunca realizou procedimentos estéticos)";
        }
        briefing = `Avaliação Facial Completa${detalhe}.`;
      }

      // Adiciona detalhes sobre receio de dor ou agulhas
      if (textHistory.includes("medo") || textHistory.includes("dor") || textHistory.includes("agulha") || textHistory.includes("anestesia") || textHistory.includes("anestesico")) {
        briefing += " Relatou sensibilidade à dor / receio de agulhas.";
      }

      // Adiciona nota sobre valores se questionou preço
      if (textHistory.includes("valor") || textHistory.includes("preco") || textHistory.includes("quanto") || textHistory.includes("custa")) {
        briefing += " Solicitou informações de valores/formas de pagamento.";
      }
    }

    return {
      ...r,
      briefing,
    };
  });

  res.json(appointments);
});
