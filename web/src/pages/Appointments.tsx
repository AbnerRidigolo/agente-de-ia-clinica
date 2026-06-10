import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { api, type Appointment } from "../lib/api";
import { Card, StatusBadge, EmptyState, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

function formatDateTime(s: string): string {
  return new Date(s.replace(" ", "T") + "Z").toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Appointments() {
  const [rows, setRows] = useState<Appointment[] | null>(null);

  useEffect(() => {
    api.appointments().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Consultas criadas e canceladas pelo agente em tempo real — o mesmo banco que as ferramentas do agente usam."
      />

      <Card className="overflow-hidden">
        {rows === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-10" />}
            title="Nenhuma consulta agendada"
            hint="Agende uma consulta pela página “Testar agente” e ela aparecerá aqui."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                <th className="px-5 py-3 font-medium">Paciente</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Procedimento</th>
                <th className="px-5 py-3 font-medium">Data/hora</th>
                <th className="px-5 py-3 font-medium">Briefing para a Dra. Daniela</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-stone-50/60">
                  <td className="px-5 py-3 font-medium text-stone-800">{a.patient}</td>
                  <td className="px-5 py-3 text-stone-500">{a.phone}</td>
                  <td className="px-5 py-3 text-stone-600">
                    <span className="font-semibold text-stone-850">{a.specialty}</span>
                    {(a.utm_source || a.utm_campaign) && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        <span className="inline-flex items-center rounded bg-stone-100 px-1.5 py-0.5 text-stone-500 font-mono capitalize">
                          {a.utm_source}
                        </span>
                        {a.utm_campaign && (
                          <span className="inline-flex items-center rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 font-medium truncate max-w-[150px]">
                            {a.utm_campaign}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone-600">{formatDateTime(a.starts_at)}</td>
                  <td className="px-5 py-3 text-stone-600 max-w-xs md:max-w-md">
                    <div className="rounded-lg bg-stone-50/70 p-2.5 border-l-2 border-brand-500 text-xs shadow-xs">
                      <span className="block font-semibold text-brand-800 mb-0.5">Resumo para a Dra. Daniela:</span>
                      <p className="text-stone-600 leading-relaxed">
                        {a.briefing || "Sem observações extraídas do chat."}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
