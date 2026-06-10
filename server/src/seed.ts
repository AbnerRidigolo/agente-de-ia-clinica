import { db } from "./db.js";

/** Popula o banco com dados de demonstração (idempotente). */
export function seedIfEmpty(): void {
  const hasSlots = (db.prepare("SELECT COUNT(*) AS n FROM slots").get() as { n: number }).n > 0;
  if (hasSlots) return;
  const specialties: [string, string][] = [
    ["Harmonização Facial", "Dra. Daniela Morais"],
    ["Toxina Botulínica", "Dra. Daniela Morais"],
    ["Preenchimento", "Dra. Daniela Morais"],
    ["Bioestimuladores de Colágeno", "Dra. Daniela Morais"],
    ["Skinbooster", "Dra. Daniela Morais"],
    ["Avaliação Facial", "Dra. Daniela Morais"],
  ];

  const insertSlot = db.prepare("INSERT INTO slots (specialty, professional, starts_at) VALUES (?, ?, ?)");
  const slotDate = (daysAhead: number, time: string): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const [h, m] = time.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString().slice(0, 19).replace("T", " ");
  };
  const days = [1, 2, 3, 5, 7];
  const times = ["09:00", "10:30", "14:00", "16:30"];
  for (const [spec, prof] of specialties) {
    for (const day of days) {
      for (const time of times.slice(0, 2 + Math.floor(Math.random() * 3))) {
        insertSlot.run(spec, prof, slotDate(day, time));
      }
    }
  }

  db.prepare("INSERT INTO knowledge_base (topic, content) VALUES (?, ?)").run(
    "convenios",
    JSON.stringify([])
  );

  const kb: [string, string][] = [
    ["endereco e como chegar", "A clínica da Dra. Daniela Morais fica na Av. Paulista, 2000, conjunto 1205 — Bela Vista, São Paulo/SP. Fica próxima ao Metrô Consolação. Estacionamento conveniado no subsolo do próprio edifício comercial, com acesso de segurança e manobrista (R$ 15 por período de até 2 horas para pacientes da clínica)."],
    ["horario de funcionamento", "Funcionamos de segunda a sexta das 9h às 19h e aos sábados das 9h às 13h. Não abrimos aos domingos e feriados."],
    ["valores", "A avaliação facial completa com a Dra. Daniela Morais custa R$ 150. Os procedimentos estéticos têm valores a partir de: Toxina Botulínica a partir de R$ 1.200; Preenchimento labial/facial (por ml) a partir de R$ 1.500; Bioestimuladores de colágeno a partir de R$ 1.800; Skinbooster a partir de R$ 800. A harmonização facial completa requer uma avaliação individualizada para orçamento definitivo."],
    ["formas de pagamento", "Formas de pagamento aceitas: PIX (com 5% de desconto), cartões de crédito em até 6x sem juros, ou entrada de 30% no PIX + saldo em até 4x no cartão."],
    ["estacionamento", "Estacionamento conveniado disponível no subsolo do próprio edifício comercial, com acesso de segurança e manobrista (R$ 15 por período de até 2 horas para pacientes da clínica)."],
    ["preparo harmonização", "Evite o consumo de bebidas alcoólicas e o uso de anti-inflamatórios ou aspirina nas 48 horas que antecedem o procedimento. Chegue com 15 minutos de antecedência. Solicitamos vir sem maquiagem pesada no dia para a realização de fotos digitais de mapeamento facial."],
    ["preparo toxina", "Evite bebidas alcoólicas 24 horas antes do procedimento. Não utilize maquiagem no rosto no dia da aplicação. Comunique qualquer medicação ou alergia ativa."],
    ["preparo preenchimento", "Evite aspirina, ginkgo biloba ou anti-inflamatórios nas 48 horas anteriores ao procedimento para reduzir o risco de hematomas. Venha sem maquiagem na região a ser tratada."],
    ["preparo bioestimuladores", "Evite bebidas alcoólicas e anti-inflamatórios nas 48 horas anteriores ao procedimento. Venha com a pele limpa e sem maquiagem."],
    ["cuidados pós-procedimento", "Não deite ou deite com a cabeça baixa nas primeiras 4 horas após a aplicação de toxina botulínica. Evite massagear ou pressionar as áreas tratadas. Não realize atividade física intensa nas primeiras 24 horas. Evite exposição direta ao sol e utilize protetor solar FPS 50+."],
    ["politica de cancelamento", "Cancelamentos ou remarcações devem ser comunicados com no mínimo 24h de antecedência. Em caso de não comparecimento sem aviso prévio ou cancelamento tardio, o sinal de agendamento não será reembolsável."],
  ];
  const insertKb = db.prepare("INSERT INTO knowledge_base (topic, content) VALUES (?, ?)");
  for (const [topic, content] of kb) insertKb.run(topic, content);

  // Pacientes e histórico de conversas para o painel não nascer vazio
  const insertPatient = db.prepare("INSERT INTO patients (name, phone, insurance) VALUES (?, ?, ?)");
  insertPatient.run("Maria Oliveira", "11988887777", "particular");
  insertPatient.run("João Pereira", "11977776666", "particular");
  insertPatient.run("Fernanda Costa", "11966665555", "particular");

  db.prepare(
    "INSERT INTO appointments (patient_id, specialty, professional, starts_at) VALUES (1, 'Preenchimento', 'Dra. Daniela Morais', datetime('now', '+2 days', 'start of day', '+10 hours'))"
  ).run();
  db.prepare(
    "INSERT INTO appointments (patient_id, specialty, professional, starts_at) VALUES (3, 'Harmonização Facial', 'Dra. Daniela Morais', datetime('now', '+4 days', 'start of day', '+14 hours'))"
  ).run();

  const demoConversations: {
    contact: string; status: string; intent: string; csat: number | null; daysAgo: number;
    msgs: [string, string][];
  }[] = [
    {
      contact: "Maria Oliveira", status: "resolvida", intent: "agendamento", csat: 5, daysAgo: 1,
      msgs: [
        ["user", "Oi, queria marcar um preenchimento"],
        ["assistant", "Olá, Maria! Encontrei estes horários disponíveis para Preenchimento com a Dra. Daniela Morais:\n1. Quinta às 10h\n2. Sexta às 14h\nQual você prefere?"],
        ["user", "Quinta às 10h"],
        ["assistant", "Perfeito! Consulta de Preenchimento confirmada com a Dra. Daniela Morais para quinta-feira às 10h. Chegue 15 minutos antes e, por favor, venha sem maquiagem pesada. 😊"],
      ],
    },
    {
      contact: "João Pereira", status: "resolvida", intent: "convenio", csat: 4, daysAgo: 1,
      msgs: [
        ["user", "Vocês aceitam Bradesco Saúde?"],
        ["assistant", "Olá, João! A clínica da Dra. Daniela Morais atende exclusivamente na modalidade particular. Deseja agendar uma avaliação facial para conhecer nossos procedimentos e valores? 😊"],
        ["user", "No momento não, obrigado"],
        ["assistant", "Sem problemas! Qualquer dúvida é só chamar. ✨"],
      ],
    },
    {
      contact: "Fernanda Costa", status: "escalada", intent: "escalonamento", csat: null, daysAgo: 2,
      msgs: [
        ["user", "Fui cobrada duas vezes pelo sinal da harmonização, quero ver isso"],
        ["assistant", "Sinto muito pelo ocorrido, Fernanda. Vou transferir sua conversa agora mesmo para a nossa equipe financeira humana resolver isso para você. O tempo médio de resposta é de 5 minutos."],
      ],
    },
    {
      contact: "11955554444", status: "resolvida", intent: "duvida_geral", csat: 5, daysAgo: 3,
      msgs: [
        ["user", "Onde fica a clínica de vocês?"],
        ["assistant", "A clínica da Dra. Daniela Morais fica na Av. Paulista, 2000, conjunto 1205 — Bela Vista, São Paulo/SP, próxima ao Metrô Consolação. Temos estacionamento com manobrista no subsolo. 😊"],
      ],
    },
    {
      contact: "11944443333", status: "resolvida", intent: "cancelamento", csat: 3, daysAgo: 4,
      msgs: [
        ["user", "Preciso cancelar minha avaliação de amanhã"],
        ["assistant", "Localizei sua Avaliação Facial agendada para amanhã às 9h. Você confirma o cancelamento? Lembrando que desmarcações devem ser feitas com 24h de antecedência. 😊"],
        ["user", "Sim, pode cancelar"],
        ["assistant", "Avaliação cancelada com sucesso. Quando desejar remarcar, basta me chamar! ✨"],
      ],
    },
    {
      contact: "11933332222", status: "resolvida", intent: "agendamento", csat: 5, daysAgo: 5,
      msgs: [
        ["user", "Queria marcar botox essa semana"],
        ["assistant", "Olá! A Dra. Daniela Morais tem horários disponíveis para aplicação de Toxina Botulínica:\n1. Quarta às 9h\n2. Sexta às 16h30\nQual deles fica melhor para você?"],
        ["user", "Sexta às 16h30"],
        ["assistant", "Agendamento confirmado: Toxina Botulínica com a Dra. Daniela Morais na sexta às 16h30. Por favor, evite bebidas alcoólicas nas 24h anteriores ao procedimento. Até lá! 😊"],
      ],
    },
  ];

  const insertConv = db.prepare(
    "INSERT INTO conversations (channel, contact, status, intent, csat, created_at, updated_at) VALUES ('web', ?, ?, ?, ?, datetime('now', ?), datetime('now', ?))"
  );
  const insertMsg = db.prepare(
    "INSERT INTO messages (conversation_id, role, content, latency_ms, created_at) VALUES (?, ?, ?, ?, datetime('now', ?))"
  );
  let convId = 0;
  for (const c of demoConversations) {
    insertConv.run(c.contact, c.status, c.intent, c.csat, `-${c.daysAgo} days`, `-${c.daysAgo} days`);
    convId = (db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id;
    for (const [role, content] of c.msgs) {
      insertMsg.run(convId, role, content, role === "assistant" ? 1200 + Math.floor(Math.random() * 1800) : null, `-${c.daysAgo} days`);
    }
  }

  console.log("[seed] Dados de demonstração criados.");
}

// Permite rodar via `npm run seed`
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedIfEmpty();
}
