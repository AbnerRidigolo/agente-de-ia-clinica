export interface Metrics {
  totalConversations: number;
  resolved: number;
  escalated: number;
  open: number;
  deflectionRate: number | null;
  avgCsat: number | null;
  avgLatencyMs: number | null;
  byIntent: { intent: string; count: number }[];
  byDay: { day: string; total: number; escalated: number }[];
  guardrails: { rule: string; count: number }[];
}

export interface ConversationSummary {
  id: number;
  channel: string;
  contact: string | null;
  status: "aberta" | "resolvida" | "escalada";
  intent: string | null;
  csat: number | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface Message {
  id: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  tool_name: string | null;
  latency_ms: number | null;
  created_at: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: Message[];
  guardrails: { rule: string; detail: string | null; created_at: string }[];
}

export interface Appointment {
  id: number;
  patient: string;
  phone: string;
  insurance: string | null;
  specialty: string;
  professional: string;
  starts_at: string;
  status: string;
}

export interface Settings {
  persona: string;
  aops: string;
  model: string;
  mockMode: boolean;
}

export type CrmStage = "novo" | "lead" | "ativo" | "vip" | "inativo";

export interface CrmClient {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  insurance: string | null;
  stage: CrmStage;
  notes: string | null;
  created_at: string;
  total_appointments: number;
  next_appointment: string | null;
  last_activity: string | null;
}

export interface CrmInteraction {
  id: number;
  type: "nota" | "sistema" | "conversa";
  content: string;
  created_at: string;
}

export interface CrmClientDetail {
  client: CrmClient;
  appointments: { id: number; specialty: string; professional: string; starts_at: string; status: string }[];
  interactions: CrmInteraction[];
  conversations: { id: number; status: string; intent: string | null; csat: number | null; updated_at: string }[];
}

export interface ChatResponse {
  conversationId: number;
  reply: string;
  escalated: boolean;
  toolsUsed: string[];
  latencyMs: number;
  mock: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  metrics: () => request<Metrics>("/api/metrics"),
  conversations: (status?: string) =>
    request<ConversationSummary[]>(`/api/conversations${status ? `?status=${status}` : ""}`),
  conversation: (id: number) => request<ConversationDetail>(`/api/conversations/${id}`),
  resolveConversation: (id: number) =>
    request<{ ok: boolean }>(`/api/conversations/${id}/resolve`, { method: "POST" }),
  appointments: () => request<Appointment[]>("/api/appointments"),
  settings: () => request<Settings>("/api/settings"),
  saveSettings: (data: { persona?: string; aops?: string }) =>
    request<{ ok: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),
  resetSettings: () => request<{ ok: boolean }>("/api/settings/reset", { method: "POST" }),
  chat: (message: string, conversationId?: number) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationId }),
    }),
  crmClients: (search?: string, stage?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stage) params.set("stage", stage);
    const qs = params.toString();
    return request<CrmClient[]>(`/api/crm/clients${qs ? `?${qs}` : ""}`);
  },
  crmClient: (id: number) => request<CrmClientDetail>(`/api/crm/clients/${id}`),
  crmCreateClient: (data: Partial<CrmClient>) =>
    request<{ id: number }>("/api/crm/clients", { method: "POST", body: JSON.stringify(data) }),
  crmUpdateClient: (id: number, data: Partial<CrmClient>) =>
    request<{ ok: boolean }>(`/api/crm/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  crmAddNote: (id: number, content: string) =>
    request<{ ok: boolean }>(`/api/crm/clients/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  feedback: (conversationId: number, csat: number, resolved?: boolean) =>
    request<{ ok: boolean }>("/api/chat/feedback", {
      method: "POST",
      body: JSON.stringify({ conversationId, csat, resolved }),
    }),
};
