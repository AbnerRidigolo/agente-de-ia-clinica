import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(29,41,38,0.06)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  aberta: "bg-amber-50 text-amber-700 ring-amber-600/20",
  resolvida: "bg-brand-50 text-brand-700 ring-brand-600/20",
  escalada: "bg-rose-50 text-rose-700 ring-rose-600/20",
  confirmada: "bg-brand-50 text-brand-700 ring-brand-600/20",
  cancelada: "bg-stone-100 text-stone-500 ring-stone-400/20",
  realizada: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        statusStyles[status] ?? "bg-stone-100 text-stone-600 ring-stone-400/20"
      )}
    >
      {status}
    </span>
  );
}

export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return <span className="text-xs text-stone-400">—</span>;
  const labels: Record<string, string> = {
    agendamento: "Agendamento",
    cancelamento: "Cancelamento",
    convenio: "Convênio",
    duvida_geral: "Dúvida geral",
    escalonamento: "Escalonamento",
  };
  return (
    <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
      {labels[intent] ?? intent}
    </span>
  );
}

export function Csat({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-stone-400">—</span>;
  return (
    <span className="text-xs font-medium text-stone-700">
      {"★".repeat(value)}
      <span className="text-stone-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-stone-300">{icon}</div>
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {hint && <p className="max-w-sm text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="size-7 animate-spin rounded-full border-2 border-stone-200 border-t-brand-600" />
    </div>
  );
}
