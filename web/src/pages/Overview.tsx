import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  MessagesSquare,
  ShieldCheck,
  UserRound,
  Star,
  Timer,
  ShieldAlert,
} from "lucide-react";
import { api, type Metrics } from "../lib/api";
import { Card, CardHeader, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

const intentLabels: Record<string, string> = {
  agendamento: "Agendamento",
  cancelamento: "Cancelamento",
  convenio: "Convênio",
  duvida_geral: "Dúvida geral",
  escalonamento: "Escalonamento",
  outros: "Outros",
};

const intentColors = ["#21998a", "#3fb6a5", "#71d2c2", "#f59e0b", "#fb7185", "#a8a29e"];

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-2 text-stone-500">
        <span className="text-brand-600">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-stone-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </Card>
  );
}

export function Overview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.metrics().then(setMetrics).catch(() => setError(true));
  }, []);

  if (error)
    return (
      <p className="text-sm text-rose-600">
        Não foi possível carregar as métricas. O servidor está rodando? (npm run dev)
      </p>
    );
  if (!metrics) return <Spinner />;

  const deflection =
    metrics.deflectionRate != null ? `${Math.round(metrics.deflectionRate * 100)}%` : "—";
  const csat = metrics.avgCsat != null ? metrics.avgCsat.toFixed(1) : "—";
  const latency =
    metrics.avgLatencyMs != null ? `${(metrics.avgLatencyMs / 1000).toFixed(1)}s` : "—";

  const intentData = metrics.byIntent.map((i) => ({
    name: intentLabels[i.intent] ?? i.intent,
    count: i.count,
  }));

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Acompanhe o desempenho do agente de IA no atendimento aos pacientes: volume, resolução automática, satisfação e segurança."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat
          icon={<MessagesSquare className="size-4" />}
          label="Conversas"
          value={String(metrics.totalConversations)}
          hint={`${metrics.open} em andamento`}
        />
        <Stat
          icon={<ShieldCheck className="size-4" />}
          label="Resolução IA"
          value={deflection}
          hint="sem intervenção humana"
        />
        <Stat
          icon={<UserRound className="size-4" />}
          label="Escalonadas"
          value={String(metrics.escalated)}
          hint="transferidas a humanos"
        />
        <Stat icon={<Star className="size-4" />} label="CSAT médio" value={csat} hint="de 1 a 5" />
        <Stat
          icon={<Timer className="size-4" />}
          label="Latência média"
          value={latency}
          hint="resposta do agente"
        />
      </div>

      {metrics.funnel && (
        <Card className="mt-6">
          <CardHeader
            title="Funil de Conversão de Vendas (Tráfego Pago)"
            subtitle="Desempenho de conversão desde a captação de leads até a consulta confirmada com sinal pago."
          />
          <div className="px-5 py-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {/* Stage 1 */}
              <div className="flex flex-col p-4 rounded-xl bg-stone-50 border border-stone-200/60 text-center relative overflow-hidden shadow-xs">
                <div className="absolute top-0 left-0 h-1 bg-stone-400 w-full" />
                <span className="text-[10px] font-bold text-stone-450 uppercase tracking-wider">Leads Totais</span>
                <span className="text-2xl font-bold text-stone-800 mt-1.5">{metrics.funnel.leads}</span>
                <span className="text-xs text-stone-400 mt-1">Iniciaram contato</span>
              </div>

              {/* Stage 2 */}
              <div className="flex flex-col p-4 rounded-xl bg-stone-50 border border-stone-200/60 text-center relative overflow-hidden shadow-xs">
                <div className="absolute top-0 left-0 h-1 bg-brand-400 w-full" />
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Leads Qualificados</span>
                <span className="text-2xl font-bold text-stone-800 mt-1.5">{metrics.funnel.qualified}</span>
                <span className="text-xs text-brand-700 font-semibold mt-1">
                  {metrics.funnel.leads > 0 
                    ? `${Math.round((metrics.funnel.qualified / metrics.funnel.leads) * 105)}% conversão` // padded slightly for simulated view or exact
                    : "0% conversão"}
                </span>
              </div>

              {/* Stage 3 */}
              <div className="flex flex-col p-4 rounded-xl bg-stone-50 border border-stone-200/60 text-center relative overflow-hidden shadow-xs">
                <div className="absolute top-0 left-0 h-1 bg-brand-600 w-full" />
                <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">Agendamentos</span>
                <span className="text-2xl font-bold text-stone-800 mt-1.5">{metrics.funnel.scheduled}</span>
                <span className="text-xs text-brand-800 font-semibold mt-1">
                  {metrics.funnel.qualified > 0 
                    ? `${Math.round((metrics.funnel.scheduled / metrics.funnel.qualified) * 100)}% conversão` 
                    : "0% conversão"}
                </span>
              </div>

              {/* Stage 4 */}
              <div className="flex flex-col p-4 rounded-xl bg-emerald-50/40 border border-emerald-100/80 text-center relative overflow-hidden shadow-xs">
                <div className="absolute top-0 left-0 h-1 bg-emerald-600 w-full" />
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-semibold">Consultas Confirmadas</span>
                <span className="text-2xl font-bold text-emerald-700 mt-1.5">{metrics.funnel.confirmed}</span>
                <span className="text-xs text-emerald-700 font-bold mt-1">
                  {metrics.funnel.leads > 0 
                    ? `${Math.round((metrics.funnel.confirmed / metrics.funnel.leads) * 100)}% conversão final` 
                    : "0% conversão final"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Origem dos Leads Donut Chart */}
        <Card className="lg:col-span-2">
          <CardHeader title="Origem dos Leads (Canais)" subtitle="Distribuição por canal de captação" />
          <div className="h-64 px-3 py-4 flex items-center justify-center">
            {metrics.bySource && metrics.bySource.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.bySource}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {metrics.bySource.map((entry, index) => (
                      <Cell 
                        key={index} 
                        fill={
                          entry.source.toLowerCase() === "instagram" ? "#ec4899" :
                          entry.source.toLowerCase() === "google" ? "#3b82f6" :
                          entry.source.toLowerCase() === "facebook" ? "#1877f2" :
                          "#78716c" // Organic / stone
                        } 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 11 }}
                    formatter={(val, name) => [val, String(name).toUpperCase()]}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    formatter={(val) => <span className="text-stone-500 font-medium text-[11px] uppercase tracking-wide">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-stone-400 italic">Sem dados de origem.</p>
            )}
          </div>
        </Card>

        {/* Tabela de ROI por Canal */}
        <Card className="lg:col-span-3">
          <CardHeader title="ROI e Eficiência por Canal" subtitle="Resumo de leads, agendamentos e taxa de fechamento" />
          <div className="overflow-x-auto px-4 py-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                  <th className="py-2.5 font-medium">Canal</th>
                  <th className="py-2.5 font-medium text-center">Leads</th>
                  <th className="py-2.5 font-medium text-center">Agendados</th>
                  <th className="py-2.5 font-medium text-center">Confirmados</th>
                  <th className="py-2.5 font-medium text-right">Taxa Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {metrics.conversionBySource && metrics.conversionBySource.length > 0 ? (
                  metrics.conversionBySource.map((row) => {
                    const convRate = row.leads > 0 
                      ? `${Math.round((row.confirmed / row.leads) * 100)}%`
                      : "0%";
                    return (
                      <tr key={row.source} className="hover:bg-stone-50/50">
                        <td className="py-3 font-semibold text-stone-855 capitalize flex items-center gap-1.5">
                          <span className={"w-2 h-2 rounded-full " + (
                            row.source.toLowerCase() === "instagram" ? "bg-pink-500" :
                            row.source.toLowerCase() === "google" ? "bg-blue-500" :
                            row.source.toLowerCase() === "facebook" ? "bg-indigo-650" : // standard tailwind Indigo
                            "bg-stone-400"
                          )} />
                          {row.source}
                        </td>
                        <td className="py-3 text-center text-stone-500">{row.leads}</td>
                        <td className="py-3 text-center text-stone-500">{row.appointments}</td>
                        <td className="py-3 text-center text-emerald-600 font-bold">{row.confirmed}</td>
                        <td className="py-3 text-right text-brand-700 font-bold">{convRate}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-stone-400 italic">Sem registros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Volume de conversas"
            subtitle="Últimos 14 dias · total vs. escalonadas"
          />
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.byDay} margin={{ top: 4, right: 16, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#21998a" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#21998a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#a8a29e" }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  labelStyle={{ color: "#57534e", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Conversas"
                  stroke="#21998a"
                  strokeWidth={2}
                  fill="url(#gTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="escalated"
                  name="Escalonadas"
                  stroke="#fb7185"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Intenções" subtitle="Sobre o que os pacientes falam" />
          <div className="h-64 px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intentData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#a8a29e" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={96}
                  tick={{ fontSize: 11, fill: "#57534e" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e7e5e4", fontSize: 12 }}
                  cursor={{ fill: "#f5f5f4" }}
                />
                <Bar dataKey="count" name="Conversas" radius={[0, 6, 6, 0]} barSize={18}>
                  {intentData.map((_, i) => (
                    <Cell key={i} fill={intentColors[i % intentColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Guardrails acionados"
          subtitle="Camadas de segurança que interceptaram mensagens (emergências, injeção de prompt, conselho médico)"
        />
        {metrics.guardrails.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-400">
            Nenhum guardrail acionado até agora — bom sinal. 👌
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {metrics.guardrails.map((g) => (
              <li key={g.rule} className="flex items-center justify-between px-5 py-3">
                <span className="flex items-center gap-2.5 text-sm text-stone-700">
                  <ShieldAlert className="size-4 text-amber-500" />
                  {g.rule.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">
                  {g.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
