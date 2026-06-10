import { useEffect, useState } from "react";
import { Save, RotateCcw, Cpu, FlaskConical } from "lucide-react";
import { api, type Settings as SettingsData } from "../lib/api";
import { Card, CardHeader, Spinner } from "../components/ui";
import { PageHeader } from "../components/Layout";

export function Settings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [persona, setPersona] = useState("");
  const [aops, setAops] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = () =>
    api.settings().then((s) => {
      setData(s);
      setPersona(s.persona);
      setAops(s.aops);
    });

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  if (!data) return <Spinner />;

  const save = async () => {
    setSaving(true);
    try {
      await api.saveSettings({ persona, aops });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    await api.resetSettings();
    await load();
    setSavedAt(Date.now());
  };

  return (
    <>
      <PageHeader
        title="Configurações do agente"
        subtitle="Persona e AOPs (Agent Operating Procedures) — os procedimentos versionados que governam o comportamento do agente, no padrão das plataformas de agentes de atendimento."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <span className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-600">
          <Cpu className="size-4 text-brand-600" />
          Modelo: <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{data.model}</code>
        </span>
        {data.mockMode && (
          <span className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            <FlaskConical className="size-4" />
            Modo demonstração — defina <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">ANTHROPIC_API_KEY</code> no servidor
          </span>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Persona"
            subtitle="Identidade, tom de voz e idioma do agente. Injetada no início do system prompt."
          />
          <div className="p-5">
            <textarea
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-brand-400 focus:bg-white"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="AOPs — Procedimentos operacionais"
            subtitle="Cada AOP define passo a passo como o agente executa um fluxo (agendar, cancelar, escalar…). O agente segue estes procedimentos à risca."
          />
          <div className="p-5">
            <textarea
              value={aops}
              onChange={(e) => setAops(e.target.value)}
              rows={22}
              className="w-full resize-y rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-[13px] leading-relaxed outline-none transition-colors focus:border-brand-400 focus:bg-white"
            />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            <Save className="size-4" />
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            <RotateCcw className="size-4" />
            Restaurar padrão
          </button>
          {savedAt && <span className="text-xs text-brand-600">Alterações aplicadas ✓</span>}
        </div>
      </div>
    </>
  );
}
