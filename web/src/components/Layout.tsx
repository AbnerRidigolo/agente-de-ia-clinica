import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  CalendarDays,
  SlidersHorizontal,
  HeartPulse,
  Sparkles,
  UsersRound,
} from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";

const nav = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes · CRM", icon: UsersRound },
  { to: "/conversas", label: "Conversas", icon: MessagesSquare },
  { to: "/playground", label: "Testar agente", icon: Bot },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/configuracoes", label: "Configurações", icon: SlidersHorizontal },
];

export function Layout() {
  const [mockMode, setMockMode] = useState<boolean | null>(null);

  useEffect(() => {
    api.settings().then((s) => setMockMode(s.mockMode)).catch(() => setMockMode(null));
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col bg-brand-950 text-brand-100">
        <div className="flex items-center gap-3 px-6 pb-6 pt-7">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">
            <HeartPulse className="size-5" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-white">
              Clínica Vida+
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-brand-400">
              Central do agente
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-500/15 text-white"
                    : "text-brand-300/80 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <Icon className="size-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-200">
            <Sparkles className="size-3.5" />
            Sofia · Agente de IA
          </div>
          {mockMode === null ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-brand-400">
              Conectando ao servidor…
            </p>
          ) : mockMode ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-300/90">
              Modo demonstração ativo. Defina{" "}
              <code className="rounded bg-black/30 px-1">OPENROUTER_API_KEY</code> para
              ligar o agente completo.
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-brand-300/90">
              <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-400 align-middle" />
              Agente em produção via OpenRouter.
            </p>
          )}
        </div>
      </aside>

      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7">
      <h1 className="font-display text-3xl font-semibold text-stone-900">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-stone-500">{subtitle}</p>}
    </header>
  );
}
