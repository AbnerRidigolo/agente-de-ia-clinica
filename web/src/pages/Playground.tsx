import { useEffect, useRef, useState } from "react";
import { SendHorizonal, RotateCcw, Wrench, UserRound, Star } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { Card } from "../components/ui";
import { PageHeader } from "../components/Layout";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  latencyMs?: number;
  escalated?: boolean;
}

const suggestions = [
  "Quero marcar uma consulta com cardiologista",
  "Vocês aceitam o convênio Unimed?",
  "Qual o horário de funcionamento da clínica?",
  "Preciso cancelar minha consulta",
  "Quero falar com um atendente humano",
];

export function Playground() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [rated, setRated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await api.chat(message, conversationId);
      setConversationId(res.conversationId);
      if (res.escalated) setEscalated(true);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply,
          toolsUsed: res.toolsUsed,
          latencyMs: res.latencyMs,
          escalated: res.escalated,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Erro ao falar com o servidor. Ele está rodando?" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setConversationId(undefined);
    setEscalated(false);
    setRated(false);
  };

  const rate = async (csat: number) => {
    if (!conversationId || rated) return;
    setRated(true);
    await api.feedback(conversationId, csat, !escalated).catch(() => undefined);
  };

  return (
    <>
      <PageHeader
        title="Testar agente"
        subtitle="Converse com a Sofia exatamente como um paciente. Cada conversa aqui aparece em “Conversas” e alimenta as métricas."
      />

      <Card className="flex h-[36rem] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              S
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">Sofia</p>
              <p className="text-[11px] text-stone-400">
                {escalated ? "Transferida para humano" : "Assistente virtual · online"}
              </p>
            </div>
            {escalated && (
              <span className="ml-2 flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600 ring-1 ring-inset ring-rose-600/20">
                <UserRound className="size-3" />
                fila humana
              </span>
            )}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100"
          >
            <RotateCcw className="size-3.5" />
            Nova conversa
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className="text-sm text-stone-400">Experimente uma destas perguntas:</p>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={clsx(
                  "max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-sm bg-brand-700 text-white"
                    : "rounded-bl-sm border border-stone-200 bg-white text-stone-800 shadow-sm"
                )}
              >
                {m.content}
                {m.role === "assistant" && (m.toolsUsed?.length || m.latencyMs != null) ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-1.5">
                    {m.toolsUsed?.map((t, j) => (
                      <span
                        key={j}
                        className="flex items-center gap-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500"
                      >
                        <Wrench className="size-2.5" />
                        {t}
                      </span>
                    ))}
                    {m.latencyMs != null && (
                      <span className="text-[10px] text-stone-300">
                        {(m.latencyMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <span className="size-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:120ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:240ms]" />
              </div>
            </div>
          )}

          {messages.length > 1 && !busy && conversationId && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <span className="mr-1 text-[11px] text-stone-400">
                {rated ? "Obrigado pela avaliação!" : "Avalie este atendimento:"}
              </span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={rated}
                  onClick={() => rate(n)}
                  className="text-stone-300 transition-colors hover:text-amber-400 disabled:cursor-default disabled:hover:text-stone-300"
                >
                  <Star className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-stone-100 px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva como um paciente…"
            className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
          >
            <SendHorizonal className="size-4" />
          </button>
        </form>
      </Card>
    </>
  );
}
