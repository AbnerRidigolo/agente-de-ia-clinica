# Agente de IA para Clínicas 🏥

Agente de atendimento ao paciente construído com **engenharia de agentes atual, no padrão Decagon**: procedimentos operacionais (AOPs), ferramentas com efeito real, guardrails determinísticos, escalonamento para humanos e analytics de operação — tudo gerenciado por um painel moderno.

A **Sofia** atende pacientes da clínica em chat: agenda, reagenda e cancela consultas, responde sobre convênios e valores, e transfere para um humano quando necessário.

## Arquitetura

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  web/ — Painel (React)      │      │  server/ — API + Agente       │
│  Vite · Tailwind · Recharts │ ───▶ │  Express · OpenRouter (OpenAI) │
│                             │      │                               │
│  · Visão geral (métricas)   │      │  Pipeline por mensagem:       │
│  · Conversas (auditoria)    │      │  1. Guardrails de entrada     │
│  · Testar agente (chat)     │      │  2. Loop agêntico (Claude     │
│  · Agenda                   │      │     + tool use)               │
│  · Configurações (AOPs)     │      │  3. Guardrails de saída       │
└─────────────────────────────┘      │  4. Persistência (SQLite)     │
                                     └──────────────────────────────┘
```

### Padrão Decagon aplicado

| Conceito | Implementação |
|---|---|
| **AOPs** (Agent Operating Procedures) | Procedimentos em linguagem natural, editáveis pelo painel, injetados no system prompt (`server/src/agent/aops.ts`) |
| **Tool use** | 7 ferramentas com efeito real no banco: buscar horários, agendar, cancelar, buscar paciente, convênios, base de conhecimento e escalonamento (`server/src/agent/tools.ts`) |
| **Guardrails** | Camadas determinísticas fora do LLM: emergências médicas (→ SAMU + humano), injeção de prompt, bloqueio de conselho médico na saída e mascaramento de PII/LGPD nos logs (`server/src/agent/guardrails.ts`) |
| **Human handoff** | Tool `escalar_para_humano` + escalonamento automático em falhas; conversas marcadas como `escalada` |
| **Analytics** | Taxa de resolução automática (deflection), CSAT, latência, volume diário, intenções e eventos de guardrail |
| **QA / Auditoria** | Transcrições completas com chamadas de ferramenta e eventos de guardrail por conversa |

### Engenharia de IA

- Modelo configurável via **OpenRouter** (padrão: `anthropic/claude-sonnet-4`)
- System prompt com persona + AOPs injetados a cada requisição
- Loop agêntico manual com limite de iterações e fallback de escalonamento
- Descrições de ferramentas prescritivas (*quando* chamar, não só o quê)
- Banco **SQLite nativo do Node** (`node:sqlite`) — zero dependências nativas

## Como rodar

Requisitos: **Node.js 22+**

```bash
npm install

# Modo demo (sem chave de API — agente simulado, painel completo)
npm run dev

# Modo produção do agente
cp .env.example .env       # adicione sua OPENROUTER_API_KEY
OPENROUTER_API_KEY=sk-or-... npm run dev
```

- Painel: **http://localhost:5173**
- API: **http://localhost:3001/api/health**

O banco é criado e populado com dados de demonstração automaticamente no primeiro start (`server/data/clinica.db`). Para recomeçar do zero, apague a pasta `server/data/`.

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/chat` | Envia mensagem do paciente `{ message, conversationId? }` |
| `POST` | `/api/chat/feedback` | Registra CSAT `{ conversationId, csat, resolved? }` |
| `GET` | `/api/conversations` | Lista conversas (filtro `?status=`) |
| `GET` | `/api/conversations/:id` | Transcrição + ferramentas + guardrails |
| `GET` | `/api/metrics` | Métricas de operação |
| `GET` | `/api/appointments` | Agenda de consultas |
| `GET/PUT` | `/api/settings` | Persona e AOPs do agente |

## Personalização

1. **Persona e AOPs**: edite direto no painel em *Configurações* (sem deploy).
2. **Ferramentas**: adicione em `server/src/agent/tools.ts` (definição + executor).
3. **Guardrails**: padrões em `server/src/agent/guardrails.ts`.
4. **Base de conhecimento e agenda**: tabelas `knowledge_base` e `slots` no SQLite — em produção, troque pelos conectores do seu ERP/agenda.
