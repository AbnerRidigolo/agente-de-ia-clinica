import { useEffect, useState } from "react";
import { MessagesSquare, Wrench, ShieldAlert, CheckCheck, MessageCircle } from "lucide-react";
import clsx from "clsx";
import {
  api,
  type ConversationSummary,
  type ConversationDetail,
} from "../lib/api";
import { Card, StatusBadge, IntentBadge, Csat, EmptyState, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

const filters = [
  { value: "", label: "Todas" },
  { value: "aberta", label: "Abertas" },
  { value: "resolvida", label: "Resolvidas" },
  { value: "escalada", label: "Escaladas" },
];

function formatDate(s: string): string {
  return new Date(s.replace(" ", "T") + "Z").toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const quickRepliesByIntent: Record<string, { label: string; text: string }[]> = {
  agendamento: [
    { label: "Confirmar Horário", text: "Olá! Vi que você conversou com a nossa assistente Sofia sobre agendar uma consulta. Vamos escolher o melhor dia e horário para a sua avaliação com a Dra. Daniela?" },
    { label: "Enviar Horários", text: "Olá! Deseja que eu envie os horários disponíveis desta semana para realizar o seu procedimento estético com a Dra. Daniela?" },
  ],
  convenio: [
    { label: "Opção Particular", text: "Olá! Vi que perguntou sobre convênios. A Dra. Daniela atende apenas particular, mas emitimos recibo para você solicitar reembolso. Vamos agendar uma avaliação?" },
  ],
  escalonamento: [
    { label: "Ajuda Geral (Handoff)", text: "Olá! Sou o atendimento humano da clínica da Dra. Daniela. Vi que a Sofia te transferiu para cá. Como posso te ajudar hoje?" },
    { label: "Resolver Financeiro", text: "Olá! Sou da equipe de atendimento. Recebi seu chamado sobre a questão de cobrança/financeiro. Pode me enviar o comprovante para eu verificar agora?" },
  ],
  duvida_geral: [
    { label: "Localização e Acesso", text: "Olá! A clínica fica na Av. Paulista, 2000, cj 1205 (próxima ao Metrô Consolação). Temos estacionamento com manobrista. Quer agendar sua avaliação?" },
  ],
};

const defaultQuickReplies = [
  { label: "Contato Geral", text: "Olá! Vi seu interesse em nossos procedimentos estéticos na clínica da Dra. Daniela Morais. Como posso te ajudar hoje?" },
];

export function Conversations() {
  const [filter, setFilter] = useState("");
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [customWaText, setCustomWaText] = useState("");

  const load = (f: string) => {
    setList(null);
    api.conversations(f || undefined).then(setList).catch(() => setList([]));
  };

  useEffect(() => load(filter), [filter]);

  useEffect(() => {
    if (selected == null) return setDetail(null);
    setDetail(null);
    setCustomWaText("");
    api.conversation(selected).then(setDetail).catch(() => setDetail(null));
  }, [selected]);

  const resolve = async (id: number) => {
    await api.resolveConversation(id);
    load(filter);
    if (selected === id) api.conversation(id).then(setDetail);
  };

  return (
    <>
      <PageHeader
        title="Conversas"
        subtitle="Auditoria completa dos atendimentos: transcrições, ferramentas usadas pelo agente e eventos de guardrail."
      />

      <div className="mb-4 flex gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "bg-brand-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-2">
          {list === null ? (
            <Spinner />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare className="size-10" />}
              title="Nenhuma conversa"
              hint="Use a página “Testar agente” para gerar conversas."
            />
          ) : (
            <ul className="max-h-[34rem] divide-y divide-stone-100 overflow-y-auto">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={clsx(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-stone-50 border-l-4",
                      selected === c.id ? "bg-brand-50/60" : "",
                      c.status === "escalada" ? "border-l-amber-500 bg-amber-50/20" : "border-l-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-stone-800">
                        {c.contact ?? `Conversa #${c.id}`}
                      </span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5 text-xs text-stone-400">
                      <IntentBadge intent={c.intent} />
                      <span>{c.message_count} msgs</span>
                      <span>{formatDate(c.updated_at)}</span>
                      <Csat value={c.csat} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-3">
          {selected == null ? (
            <EmptyState
              icon={<MessagesSquare className="size-10" />}
              title="Selecione uma conversa"
              hint="A transcrição completa, com chamadas de ferramentas e guardrails, aparece aqui."
            />
          ) : detail == null ? (
            <Spinner />
          ) : (
            <div className="flex h-[34rem] flex-col">
              {(() => {
                const rawPhone = detail.conversation.phone || "";
                const cleanPhone = rawPhone.replace(/\D/g, "");
                const formattedPhone = cleanPhone.length === 10 || cleanPhone.length === 11 
                  ? `55${cleanPhone}` 
                  : cleanPhone;

                const defaultWaText = `Olá! Sou a secretária da Dra. Daniela Morais. Vi que você conversou com a nossa assistente virtual Sofia. Vamos agendar a sua avaliação facial?`;
                const activeWaText = customWaText || defaultWaText;
                const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(activeWaText)}`;

                const replies = quickRepliesByIntent[detail.conversation.intent || ""] || defaultQuickReplies;

                return (
                  <>
                    <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-stone-800">
                          {detail.conversation.contact ?? `Conversa #${detail.conversation.id}`}
                        </span>
                        <StatusBadge status={detail.conversation.status} />
                      </div>
                      {detail.conversation.status !== "resolvida" && (
                        <button
                          onClick={() => resolve(detail.conversation.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
                        >
                          <CheckCheck className="size-3.5" />
                          Marcar resolvida
                        </button>
                      )}
                    </div>

                    <div className="flex flex-1 min-h-0 divide-x divide-stone-100">
                      {/* Transcrição da Conversa */}
                      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                        {detail.messages.map((m) =>
                          m.role === "tool" ? (
                            <div
                              key={m.id}
                              className="mx-auto flex max-w-md items-start gap-2 rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2"
                            >
                              <Wrench className="mt-0.5 size-3.5 shrink-0 text-stone-400" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-stone-500">
                                  {m.tool_name}
                                </p>
                                <p className="truncate text-[11px] text-stone-400">{m.content}</p>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={m.id}
                              className={clsx("flex", m.role === "user" ? "justify-start" : "justify-end")}
                            >
                              <div
                                className={clsx(
                                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                  m.role === "user"
                                    ? "rounded-bl-sm bg-stone-100 text-stone-800"
                                    : "rounded-br-sm bg-brand-700 text-white"
                                )}
                              >
                                {m.content}
                                {m.latency_ms != null && (
                                  <span className="mt-1 block text-right text-[10px] opacity-60">
                                    {(m.latency_ms / 1000).toFixed(1)}s
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        )}

                        {detail.guardrails.length > 0 && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <ShieldAlert className="size-3.5" />
                              Eventos de guardrail
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {detail.guardrails.map((g, i) => (
                                <li key={i} className="text-xs text-amber-700/90">
                                  <span className="font-medium">{g.rule.replaceAll("_", " ")}</span>
                                  {g.detail ? ` — ${g.detail}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Ficha Lateral do Lead */}
                      <div className="w-64 shrink-0 bg-stone-50/50 p-4 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Ficha do Lead
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-stone-800">
                              {detail.conversation.contact && !/^\d+$/.test(detail.conversation.contact) 
                                ? detail.conversation.contact 
                                : "Lead não identificado"}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              WhatsApp / Contato
                            </h4>
                            <p className="mt-1 text-xs text-stone-600 font-mono">
                              {detail.conversation.phone ?? "Não informado"}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Interesse (Intenção)
                            </h4>
                            <div className="mt-1">
                              <IntentBadge intent={detail.conversation.intent} />
                            </div>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Origem do Lead (UTM)
                            </h4>
                            <div className="mt-1 flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 capitalize">
                                Source: {detail.conversation.utm_source || "Orgânico"}
                              </span>
                              {detail.conversation.utm_campaign && (
                                <span className="inline-flex w-fit items-center rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 truncate max-w-[210px]">
                                  Campanha: {detail.conversation.utm_campaign}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Status do Lead
                            </h4>
                            <div className="mt-1">
                              <StatusBadge status={detail.conversation.status} />
                            </div>
                          </div>

                          {/* Histórico / Timeline do Paciente */}
                          <div className="pt-2 border-t border-stone-200">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                              Histórico de Consultas
                            </h4>
                            {detail.appointments && detail.appointments.length > 0 ? (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                {detail.appointments.map((appt) => (
                                  <div key={appt.id} className="rounded border border-stone-200/80 bg-white p-2 text-[10px] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center justify-between font-semibold text-stone-700">
                                      <span className="truncate max-w-[100px]">{appt.specialty}</span>
                                      <span className={clsx(
                                        "text-[8px] px-1 rounded-sm uppercase tracking-wider font-bold",
                                        appt.status === "confirmada" ? "bg-brand-50 text-brand-700" :
                                        appt.status === "realizada" ? "bg-sky-50 text-sky-700" :
                                        "bg-stone-100 text-stone-500"
                                      )}>
                                        {appt.status}
                                      </span>
                                    </div>
                                    <div className="text-stone-400 mt-0.5 font-mono text-[9px]">
                                      {new Date(appt.starts_at.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-stone-450 italic">Sem consultas registradas.</p>
                            )}
                          </div>

                          {/* Respostas Rápidas */}
                          <div className="pt-2 border-t border-stone-200">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                              Respostas Rápidas
                            </h4>
                            <div className="flex flex-col gap-1.5">
                              {replies.map((reply, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setCustomWaText(reply.text);
                                    navigator.clipboard.writeText(reply.text).catch(() => {});
                                  }}
                                  className={clsx(
                                    "text-left text-[10px] p-2 rounded border transition-all cursor-pointer",
                                    customWaText === reply.text 
                                      ? "bg-brand-50 border-brand-300 text-brand-800 font-medium" 
                                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                                  )}
                                >
                                  <span className="block font-semibold text-[8px] text-stone-400 uppercase tracking-wider mb-0.5">
                                    {reply.label}
                                  </span>
                                  <span className="line-clamp-2 leading-relaxed">
                                    {reply.text}
                                  </span>
                                </button>
                              ))}
                            </div>
                            {customWaText && (
                              <button
                                onClick={() => setCustomWaText("")}
                                className="mt-1.5 text-[9px] text-stone-400 hover:text-stone-600 underline block cursor-pointer"
                              >
                                Limpar resposta rápida
                              </button>
                            )}
                          </div>
                        </div>

                        {detail.conversation.phone && (
                          <div className="pt-3 border-t border-stone-200 mt-4">
                            {customWaText && (
                              <div className="text-[9px] text-brand-700 bg-brand-50/50 p-1.5 rounded mb-2 border border-brand-100 text-center animate-pulse">
                                Resposta rápida copiada! Pronto para colar no WhatsApp.
                              </div>
                            )}
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 shadow-sm"
                            >
                              <MessageCircle className="size-4" />
                              Chamar no WhatsApp
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
