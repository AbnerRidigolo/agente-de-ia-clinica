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

function getBriefing(specialty: string): string {
  const spec = specialty.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (spec.includes("avaliacao")) {
    return "Mapeamento facial e planejamento. Orientar: chegar 15 min antes e vir sem maquiagem pesada para fotos.";
  }
  if (spec.includes("toxina") || spec.includes("botox")) {
    return "Aplicação de botox. Orientar: evitar álcool 24h antes e não deitar/massagear nas 4h pós-procedimento.";
  }
  if (spec.includes("preenchimento")) {
    return "Preenchimento labial/facial. Orientar: evitar aspirina/anti-inflamatórios 48h antes (reduz hematomas).";
  }
  if (spec.includes("bioestimulador")) {
    return "Estímulo de colágeno. Orientar: pele limpa, evitar álcool e anti-inflamatórios nas 48h anteriores.";
  }
  if (spec.includes("skinbooster")) {
    return "Hidratação injetável profunda. Orientar: pele limpa e evitar exercícios físicos nas primeiras 24h.";
  }
  if (spec.includes("harmonizacao")) {
    return "Procedimento combinado. Orientar: sem maquiagem pesada para fotos, evitar álcool/anti-inflamatórios 48h antes.";
  }
  return "Procedimento estético. Confirmar orientações gerais de preparo e pós-procedimento.";
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
                <th className="px-5 py-3 font-medium">Briefing / Preparo Clínico</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-stone-50/60">
                  <td className="px-5 py-3 font-medium text-stone-800">{a.patient}</td>
                  <td className="px-5 py-3 text-stone-500">{a.phone}</td>
                  <td className="px-5 py-3 text-stone-600">{a.specialty}</td>
                  <td className="px-5 py-3 text-stone-600">{formatDateTime(a.starts_at)}</td>
                  <td className="px-5 py-3 text-xs text-stone-500 leading-relaxed max-w-xs md:max-w-md">
                    <span className="inline-block bg-brand-50/50 text-brand-800 rounded px-2.5 py-1 font-medium border border-brand-100/50">
                      {getBriefing(a.specialty)}
                    </span>
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
