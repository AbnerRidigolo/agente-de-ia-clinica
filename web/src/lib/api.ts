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
  funnel?: {
    leads: number;
    qualified: number;
    scheduled: number;
    confirmed: number;
  };
}

export interface ConversationSummary {
  id: number;
  channel: string;
  contact: string | null;
  phone?: string | null;
  status: "aberta" | "resolvida" | "escalada";
  intent: string | null;
  csat: number | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
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
  appointments?: { id: number; specialty: string; starts_at: string; status: string }[];
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
  briefing?: string;
  utm_source?: string | null;
  utm_campaign?: string | null;
}

export interface Settings {
  persona: string;
  aops: string;
  model: string;
  mockMode: boolean;
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
  feedback: (conversationId: number, csat: number, resolved?: boolean) =>
    request<{ ok: boolean }>("/api/chat/feedback", {
      method: "POST",
      body: JSON.stringify({ conversationId, csat, resolved }),
    }),
};
