import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";
import type { TimeType } from "./timeType";

export interface StreamPlan {
  id: string;
  date: string;
  timeType: TimeType;
  startTime: string | null;
  title: string;
  createdAt: string;
}

export interface StreamPlanInput {
  date: string;
  timeType: TimeType;
  startTime?: string | null;
  title: string;
}

export interface LiveRecord {
  title: string;
  startDate: string;
  stopDate?: string;
}

export interface LiveHistoryResponse {
  ok: boolean;
  records: LiveRecord[];
}

export interface ApiError {
  error?: string;
}

interface OkResponse {
  ok: true;
  id: string;
  date: string;
  timeType: TimeType;
  startTime: string | null;
  title: string;
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
  const response = await request<{ plans: Array<{ id: string; date: string; timeType?: string; startTime: string | null; title: string; createdAt: string }> } | ApiError>(qs ? `/api/stream-plans?${qs}` : "/api/stream-plans");
  // 归一化 timeType ?? "fixed" 防御存量数据
  if (response.status === 200 && "plans" in response.data) {
    const plans = response.data.plans.map(p => ({
      ...p,
      timeType: (p.timeType ?? "fixed") as TimeType,
    }));
    return { ...response, data: { plans } };
  }
  return response as { status: number; data: { plans: StreamPlan[] } | ApiError };
}

/** 新增直播计划（受限写，superadmin/admin）。 */
export async function createPlan(
  input: StreamPlanInput,
): Promise<{ status: number; data: OkResponse | ApiError }> {
  return request("/api/stream-plans", { method: "POST", body: input });
}

/** 编辑直播计划（受限写；改日期即改期）。 */
export async function updatePlan(
  id: string,
  input: StreamPlanInput,
): Promise<{ status: number; data: OkResponse | ApiError }> {
  return request(`/api/stream-plans/${id}`, { method: "PUT", body: input });
}

/** 删除直播计划（受限写）。 */
export async function deletePlan(
  id: string,
): Promise<{ status: number; data: { ok: true } | ApiError }> {
  return request(`/api/stream-plans/${id}`, { method: "DELETE" });
}

/**
 * 查询历史直播记录（公开读）。未配置或请求失败时静默降级为
 * `{ ok: false, records: [] }`，调用方据此不渲染历史条目。
 */
export async function listLiveHistory(): Promise<LiveHistoryResponse> {
  if (!API_CONFIGURED) {
    return { ok: false, records: [] };
  }
  try {
    const { status, data } = await request<LiveHistoryResponse | ApiError>("/api/live-history");
    if (status === 200 && "ok" in data && Array.isArray((data as LiveHistoryResponse).records)) {
      return data as LiveHistoryResponse;
    }
    return { ok: false, records: [] };
  } catch {
    return { ok: false, records: [] };
  }
}
