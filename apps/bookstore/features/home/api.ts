import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";

export interface LiveStatus {
  live: boolean;
  title: string | null;
  startedAt: string | null;
}

export interface LiveStatusResponse {
  ok: boolean;
  status: LiveStatus | null;
}

/**
 * 查询当前直播状态（公开读）。未配置或请求失败时静默降级为
 * `{ ok: false, status: null }`，调用方据此渲染中性状态。
 */
export async function getLiveStatus(): Promise<LiveStatusResponse> {
  if (!API_CONFIGURED) {
    return { ok: false, status: null };
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/live/status`, {
      credentials: "include",
    });
    const data = (await res.json()) as LiveStatusResponse;
    if (res.status === 200 && typeof data.ok === "boolean") {
      return data;
    }
    return { ok: false, status: null };
  } catch {
    return { ok: false, status: null };
  }
}