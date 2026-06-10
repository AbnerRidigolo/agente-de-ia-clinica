import { db } from "./db.js";

/** Popula o banco com dados de demonstração (idempotente). */
export function seedIfEmpty(): void {
  const hasSlots = (db.prepare("SELECT COUNT(*) AS n FROM slots").get() as { n: number }).n > 0;
  if (hasSlots) return;

  const specialties: [string, string][] = [
    ["Clínica Geral", "Dra. Ana Beltrão"],
    ["Clínica Geral", "Dr. Marcos Tavares"],
    ["Cardiologia", "Dr. Ricardo Lima"],
    ["Dermatologia", "Dra. Paula Mendes"],
    ["Pediatria", "Dra. Júlia Castro"],
    ["Ginecologia", "Dra. Carla Nunes"],
    ["Ortopedia", "Dr. Felipe Rocha"],
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
    JSON.stringify([
      { nome: "Unimed", especialidades: ["Clínica Geral", "Cardiologia", "Pediatria", "Ginecologia"] },
      { nome: "Bradesco Saúde", especialidades: ["Clínica Geral", "Dermatologia", "Ortopedia"] },
      { nome: "SulAmérica", especialidades: ["Clínica Geral", "Cardiologia", "Dermatologia", "Pediatria", "Ginecologia", "Ortopedia"] },
      { nome: "Amil", especialidades: ["Clínica Geral", "Pediatria"] },
    ])
  );

  const kb: [string, string][] = [
    ["endereco e como chegar", "A Clínica Vida+ fica na Av. Paulista, 1500, conjunto 801 — Bela Vista, São Paulo/SP. A estação de metrô mais próxima é a Trianon-Masp (Linha 2-Verde), a 200 m."],
    ["horario de funcionamento", "Funcionamos de segunda a sexta das 7h às 20h e aos sábados das 8h às 14h. Não abrimos aos domingos e feriados."],
    ["valores consultas particulares", "Valores particulares: Clínica Geral R$ 280; Cardiologia R$ 450; Dermatologia R$ 400; Pediatria R$ 350; Ginecologia R$ 380; Ortopedia R$ 420. Pagamento em até 3x sem juros."],
    ["formas de pagamento", "Aceitamos PIX, cartões de crédito (até 3x sem juros), débito e dinheiro. Não aceitamos cheques."],
    ["estacionamento", "Temos convênio com o estacionamento do prédio: R$ 12 para até 3 horas com validação na recepção."],
    ["preparo exame de sangue", "Exames de sangue: jejum de 8 a 12 horas conforme o exame; água liberada. Traga documento com foto e o pedido médico. Coletas de segunda a sábado, das 7h às 11h."],
    ["resultados de exames", "Resultados ficam disponíveis no portal do paciente (portal.clinicavidamais.com.br) em até 3 dias úteis, ou podem ser retirados presencialmente com documento com foto."],
    ["politica de cancelamento", "Cancelamentos ou remarcações devem ser feitos com pelo menos 24h de antecedência. Cancelamentos tardios ou faltas podem gerar cobrança de 30% do valor da consulta particular."],
  ];
  const insertKb = db.prepare("INSERT INTO knowledge_base (topic, content) VALUES (?, ?)");
  for (const [topic, content] of kb) insertKb.run(topic, content);

  // Pacientes e histórico de conversas para o painel não nascer vazio
  const insertPatient = db.prepare("INSERT INTO patients (name, phone, insurance) VALUES (?, ?, ?)");
  insertPatient.run("Maria Oliveira", "11988887777", "Unimed");
  insertPatient.run("João Pereira", "11977776666", "particular");
  insertPatient.run("Fernanda Costa", "11966665555", "SulAmérica");

  db.prepare(
    "INSERT INTO appointments (patient_id, specialty, professional, starts_at) VALUES (1, 'Cardiologia', 'Dr. Ricardo Lima', datetime('now', '+2 days', 'start of day', '+10 hours'))"
  ).run();
  db.prepare(
    "INSERT INTO appointments (patient_id, specialty, professional, starts_at) VALUES (3, 'Dermatologia', 'Dra. Paula Mendes', datetime('now', '+4 days', 'start of day', '+14 hours'))"
  ).run();

  const demoConversations: {
    contact: string; status: string; intent: string; csat: number | null; daysAgo: number;
    msgs: [string, string][];
  }[] = [
    {
      contact: "Maria Oliveira", status: "resolvida", intent: "agendamento", csat: 5, daysAgo: 1,
      msgs: [
        ["user", "Oi, queria marcar um cardiologista"],
        ["assistant", "Olá, Maria! Encontrei estes horários com o Dr. Ricardo Lima:\n1. Quinta às 10h\n2. Sexta às 14h\nQual prefere?"],
        ["user", "Quinta às 10h"],
        ["assistant", "Perfeito! Consulta confirmada: Cardiologia com Dr. Ricardo Lima, quinta-feira às 10h. Chegue 15 minutos antes com documento e carteirinha. 😊"],
      ],
    },
    {
      contact: "João Pereira", status: "resolvida", intent: "convenio", csat: 4, daysAgo: 1,
      msgs: [
        ["user", "Vocês aceitam Amil?"],
        ["assistant", "Aceitamos sim! A Amil cobre Clínica Geral e Pediatria aqui na clínica. Quer agendar uma consulta?"],
        ["user", "Não por enquanto, obrigado"],
        ["assistant", "Disponha! Qualquer coisa é só chamar. 😊"],
      ],
    },
    {
      contact: "Fernanda Costa", status: "escalada", intent: "escalonamento", csat: null, daysAgo: 2,
      msgs: [
        ["user", "Fui cobrada duas vezes pela mesma consulta, quero resolver isso agora"],
        ["assistant", "Sinto muito pelo transtorno, Fernanda. Questões de cobrança são tratadas pela nossa equipe — estou transferindo você para um atendente humano agora. Tempo médio de espera: 5 minutos."],
      ],
    },
    {
      contact: "11955554444", status: "resolvida", intent: "duvida_geral", csat: 5, daysAgo: 3,
      msgs: [
        ["user", "Qual o horário de funcionamento de vocês?"],
        ["assistant", "Funcionamos de segunda a sexta das 7h às 20h e aos sábados das 8h às 14h. Posso ajudar com mais alguma coisa?"],
      ],
    },
    {
      contact: "11944443333", status: "resolvida", intent: "cancelamento", csat: 3, daysAgo: 4,
      msgs: [
        ["user", "Preciso desmarcar minha consulta de amanhã"],
        ["assistant", "Localizei sua consulta de Clínica Geral amanhã às 9h. Confirma o cancelamento? Atenção: cancelamentos com menos de 24h podem gerar cobrança de 30% conforme nossa política."],
        ["user", "Sim, pode cancelar"],
        ["assistant", "Consulta cancelada. Quando quiser reagendar, é só me chamar! 😊"],
      ],
    },
    {
      contact: "11933332222", status: "resolvida", intent: "agendamento", csat: 5, daysAgo: 5,
      msgs: [
        ["user", "Tem pediatra disponível essa semana?"],
        ["assistant", "Sim! A Dra. Júlia Castro tem horários quarta às 9h e sexta às 16h30. Qual prefere?"],
        ["user", "Sexta 16h30"],
        ["assistant", "Consulta confirmada: Pediatria com Dra. Júlia Castro, sexta às 16h30. Até lá! 😊"],
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
