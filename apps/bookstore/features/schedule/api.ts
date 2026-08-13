import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";

export interface StreamPlan {
  id: string;
  date: string;
  title: string;
  createdAt: string;
}

export interface ApiError {
  error?: string;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T }> {
  if (!API_CONFIGURED) {
    return { status: 0, data: null as unknown as T };
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { status: res.status, data: data as T };
}

/** 查询区间直播计划（公开读）。from/to 为 YYYY-MM-DD，可省略。 */
export async function listPlans(
  from?: string,
  to?: string,
): Promise<{ status: number; data: { plans: StreamPlan[] } | ApiError }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return request(qs ? `/api/stream-plans?${qs}` : "/api/stream-plans");
}

/** 新增直播计划（受限写，superadmin/admin）。 */
export async function createPlan(
  date: string,
  title: string,
): Promise<{ status: number; data: { ok: true; id: string; date: string; title: string } | ApiError }> {
  return request("/api/stream-plans", { method: "POST", body: { date, title } });
}
