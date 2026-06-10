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

export function Conversations() {
  const [filter, setFilter] = useState("");
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);

  const load = (f: string) => {
    setList(null);
    api.conversations(f || undefined).then(setList).catch(() => setList([]));
  };

  useEffect(() => load(filter), [filter]);

  useEffect(() => {
    if (selected == null) return setDetail(null);
    setDetail(null);
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

                const whatsappText = `Olá! Sou a secretária da Dra. Daniela Morais. Vi que você conversou com a nossa assistente virtual Sofia. Vamos agendar a sua avaliação facial?`;
                const waLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappText)}`;

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
                      <div className="w-60 shrink-0 bg-stone-50/50 p-4 flex flex-col justify-between overflow-y-auto">
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
                              Canal de Origem
                            </h4>
                            <p className="mt-1 text-xs text-stone-600">
                              {detail.conversation.channel === "web" ? "💬 Chat do Site (Orgânico)" : "📱 Anúncio do Instagram"}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              Status do Lead
                            </h4>
                            <div className="mt-1">
                              <StatusBadge status={detail.conversation.status} />
                            </div>
                          </div>
                        </div>

                        {detail.conversation.phone && (
                          <div className="pt-4 border-t border-stone-100">
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
