import { useCallback, useEffect, useState } from "react";
import {
  UsersRound,
  Search,
  Plus,
  CalendarDays,
  StickyNote,
  Bot,
  MessagesSquare,
  Phone,
  Mail,
  Cake,
} from "lucide-react";
import clsx from "clsx";
import { api, type CrmClient, type CrmClientDetail, type CrmStage } from "../lib/api";
import { Card, EmptyState, Spinner, StatusBadge, IntentBadge, Csat } from "../components/ui";
import { PageHeader } from "../components/Layout";

const stageMeta: Record<CrmStage, { label: string; className: string }> = {
  novo: { label: "Novo", className: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  lead: { label: "Lead", className: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  ativo: { label: "Ativo", className: "bg-brand-50 text-brand-700 ring-brand-600/20" },
  vip: { label: "VIP", className: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  inativo: { label: "Inativo", className: "bg-stone-100 text-stone-500 ring-stone-400/20" },
};

const STAGES = Object.keys(stageMeta) as CrmStage[];

function StageBadge({ stage }: { stage: CrmStage }) {
  const meta = stageMeta[stage] ?? stageMeta.novo;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s.replace(" ", "T") + (s.length <= 10 ? "T00:00:00" : "Z")).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: s.length <= 10 ? "numeric" : undefined,
    hour: s.length > 10 ? "2-digit" : undefined,
    minute: s.length > 10 ? "2-digit" : undefined,
  });
}

function NewClientForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", birth_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.crmCreateClient({ ...form, stage: "lead" } as Partial<CrmClient>);
      onCreated();
    } catch {
      setError("Não foi possível salvar. Verifique nome e telefone (pode já existir).");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400 focus:bg-white";

  return (
    <form onSubmit={submit} className="space-y-3 p-5">
      <p className="text-sm font-semibold text-stone-800">Novo cliente</p>
      <input className={field} placeholder="Nome completo *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
      <div className="grid grid-cols-2 gap-3">
        <input className={field} placeholder="Telefone com DDD *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required minLength={8} />
        <input className={field} placeholder="Aniversário (AAAA-MM-DD)" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
      </div>
      <input className={field} type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <textarea className={field} rows={2} placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar cliente"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ClientDetail({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<CrmClientDetail | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(() => api.crmClient(id).then(setDetail).catch(() => setDetail(null)), [id]);
  useEffect(() => {
    setDetail(null);
    load();
  }, [load]);

  if (!detail) return <Spinner />;
  const { client, appointments, interactions, conversations } = detail;

  const changeStage = async (stage: CrmStage) => {
    await api.crmUpdateClient(client.id, { stage });
    await load();
    onChanged();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await api.crmAddNote(client.id, note.trim());
      setNote("");
      await load();
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-stone-900">{client.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
              <span className="flex items-center gap-1"><Phone className="size-3" />{client.phone}</span>
              {client.email && <span className="flex items-center gap-1"><Mail className="size-3" />{client.email}</span>}
              {client.birth_date && <span className="flex items-center gap-1"><Cake className="size-3" />{formatDate(client.birth_date)}</span>}
            </div>
          </div>
          <select
            value={client.stage}
            onChange={(e) => changeStage(e.target.value as CrmStage)}
            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 outline-none focus:border-brand-400"
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>{stageMeta[s].label}</option>
            ))}
          </select>
        </div>
        {client.notes && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">{client.notes}</p>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
            <CalendarDays className="size-3.5" /> Consultas ({appointments.length})
          </h4>
          {appointments.length === 0 ? (
            <p className="text-xs text-stone-400">Nenhuma consulta registrada.</p>
          ) : (
            <ul className="space-y-1.5">
              {appointments.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-xs">
                  <span className="text-stone-700">{a.specialty} · {a.professional}</span>
                  <span className="flex items-center gap-2 text-stone-400">
                    {formatDate(a.starts_at)}
                    <StatusBadge status={a.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
            <MessagesSquare className="size-3.5" /> Conversas com o agente ({conversations.length})
          </h4>
          {conversations.length === 0 ? (
            <p className="text-xs text-stone-400">Nenhuma conversa vinculada a este contato.</p>
          ) : (
            <ul className="space-y-1.5">
              {conversations.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-xs">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <IntentBadge intent={c.intent} />
                  </span>
                  <span className="flex items-center gap-2 text-stone-400">
                    <Csat value={c.csat} />
                    {formatDate(c.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">
            <StickyNote className="size-3.5" /> Linha do tempo
          </h4>
          <form onSubmit={addNote} className="mb-3 flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicionar anotação sobre o cliente…"
              className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={savingNote || !note.trim()}
              className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
            >
              Anotar
            </button>
          </form>
          <ul className="space-y-2">
            {interactions.map((i) => (
              <li key={i.id} className="flex gap-2.5">
                <span
                  className={clsx(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    i.type === "sistema" ? "bg-brand-50 text-brand-600" : "bg-amber-50 text-amber-600"
                  )}
                >
                  {i.type === "sistema" ? <Bot className="size-3.5" /> : <StickyNote className="size-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-stone-700">{i.content}</p>
                  <p className="text-[10px] text-stone-400">{formatDate(i.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function Clients() {
  const [clients, setClients] = useState<CrmClient[] | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.crmClients(search || undefined, stage || undefined).then(setClients).catch(() => setClients([]));
  }, [search, stage]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const stats = (clients ?? []).reduce(
    (acc, c) => {
      acc.total += 1;
      acc[c.stage] = (acc[c.stage] ?? 0) + 1;
      if (c.next_appointment) acc.upcoming += 1;
      return acc;
    },
    { total: 0, upcoming: 0 } as Record<string, number>
  );

  return (
    <>
      <PageHeader
        title="Clientes · CRM"
        subtitle="Carteira de clientes alimentada automaticamente pelo agente: quem agenda pelo chat entra aqui na hora, com histórico de consultas, conversas e anotações da equipe."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total de clientes", value: stats.total },
          { label: "Ativos + VIP", value: (stats.ativo ?? 0) + (stats.vip ?? 0) },
          { label: "Leads a converter", value: (stats.lead ?? 0) + (stats.novo ?? 0) },
          { label: "Com consulta marcada", value: stats.upcoming },
        ].map((s) => (
          <Card key={s.label} className="px-5 py-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-stone-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail…"
            className="w-72 rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3.5 text-sm outline-none transition-colors placeholder:text-stone-400 focus:border-brand-400"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setStage("")}
            className={clsx(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              stage === "" ? "bg-brand-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            )}
          >
            Todos
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStage(stage === s ? "" : s)}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                stage === s ? "bg-brand-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              )}
            >
              {stageMeta[s].label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setCreating(true);
            setSelected(null);
          }}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          <Plus className="size-4" />
          Novo cliente
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-3">
          {clients === null ? (
            <Spinner />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<UsersRound className="size-10" />}
              title="Nenhum cliente encontrado"
              hint="Cadastre manualmente ou deixe o agente agendar uma consulta — o cliente entra aqui automaticamente."
            />
          ) : (
            <div className="max-h-[36rem] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Estágio</th>
                    <th className="px-4 py-3 font-medium">Consultas</th>
                    <th className="px-4 py-3 font-medium">Próxima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {clients.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        setSelected(c.id);
                        setCreating(false);
                      }}
                      className={clsx(
                        "cursor-pointer transition-colors hover:bg-stone-50/80",
                        selected === c.id && "bg-brand-50/60"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{c.name}</p>
                        <p className="text-xs text-stone-400">{c.phone}</p>
                      </td>
                      <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                      <td className="px-4 py-3 text-stone-600">{c.total_appointments}</td>
                      <td className="px-4 py-3 text-xs text-stone-500">{formatDate(c.next_appointment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-[36rem] overflow-hidden xl:col-span-2">
          {creating ? (
            <NewClientForm
              onCreated={() => {
                setCreating(false);
                load();
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selected == null ? (
            <EmptyState
              icon={<UsersRound className="size-10" />}
              title="Selecione um cliente"
              hint="Histórico de consultas, conversas com o agente e linha do tempo de anotações aparecem aqui."
            />
          ) : (
            <ClientDetail id={selected} onChanged={load} />
          )}
        </Card>
      </div>
    </>
  );
}
