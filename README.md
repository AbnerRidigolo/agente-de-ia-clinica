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

## Deploy 24/7 em um servidor (VPS)

Em produção, **um único processo** serve a API e o painel (o Express entrega o `web/dist`). Recomendado: Docker em qualquer VPS Linux (Hetzner, DigitalOcean, Contabo, Oracle, EC2…).

```bash
# No servidor, com Docker instalado:
git clone https://github.com/abnerridigolo/agente-de-ia-clinica.git
cd agente-de-ia-clinica
cp .env.example .env            # preencha OPENROUTER_API_KEY
docker compose up -d --build
```

- Painel + API em `http://SEU_IP:3001` (o `restart: unless-stopped` mantém o agente de pé 24h e o religa se o servidor reiniciar).
- O banco SQLite fica persistido em `./server/data` (faça backup desta pasta).
- Logs: `docker compose logs -f` · Atualizar: `git pull && docker compose up -d --build`.

**Recomendações antes de expor na internet:**
1. Coloque um proxy reverso com HTTPS na frente (Caddy faz isso em 3 linhas, ou Nginx + certbot).
2. Adicione autenticação ao painel (ele expõe dados de clientes — LGPD).
3. Libere no firewall apenas as portas 80/443 (e 22 para SSH).

Sem Docker, a alternativa é PM2: `npm install && npm run build && pm2 start server/dist/index.js --name agente --node-args="--no-warnings"`.

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
| `GET/POST` | `/api/crm/clients` | CRM: lista/cadastra clientes |
| `GET/PUT` | `/api/crm/clients/:id` | CRM: detalhe (consultas, conversas, timeline) e edição |
| `POST` | `/api/crm/clients/:id/notes` | CRM: adiciona anotação à linha do tempo |

## Personalização

1. **Persona e AOPs**: edite direto no painel em *Configurações* (sem deploy).
2. **Ferramentas**: adicione em `server/src/agent/tools.ts` (definição + executor).
3. **Guardrails**: padrões em `server/src/agent/guardrails.ts`.
4. **Base de conhecimento e agenda**: tabelas `knowledge_base` e `slots` no SQLite — em produção, troque pelos conectores do seu ERP/agenda.
