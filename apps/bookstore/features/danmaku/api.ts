import { request, type ApiError } from "@/features/backdoor/api";
import type { LiveEvent, LiveEventType } from "./types";

/**
 * 弹幕看板 API 封装：历史检索与三个已读写接口。
 * 口径复用 `features/backdoor/api.ts` 的 `request()`（未配置 NEXT_PUBLIC_API_BASE_URL 时短路不 fetch，
 * 请求统一 credentials: "include"）。契约单一事实源：contract/live-events.openapi.yaml。
 */

export interface LiveEventsPage {
  total: number;
  page: number;
  pageSize: number;
  items: LiveEvent[];
}

/** 「全部已读」仅支持需要已读管理的类型（契约口径）。 */
export type ReadAllType = "super_chat" | "guard_buy";

/** 检索历史直播事件（member 及以上）。type 以重复查询参数传递。 */
export async function listLiveEvents(
  types: LiveEventType[],
  page = 1,
  pageSize = 50,
  minPrice?: number,
): Promise<{ status: number; data: LiveEventsPage | ApiError }> {
  const params = new URLSearchParams();
  for (const type of types) params.append("type", type);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (minPrice !== undefined && minPrice > 0) params.set("minPrice", String(minPrice));
  return request(`/api/live-events?${params.toString()}`);
}

/** 单条标记已读（admin 及以上，幂等）。 */
export async function markLiveEventRead(
  eventId: string,
): Promise<{ status: number; data: { ok: true } | ApiError }> {
  return request("/api/live-events/read", { method: "POST", body: { eventId } });
}

/** 单条取消已读（admin 及以上，幂等；显式 unread 覆盖水位线）。 */
export async function markLiveEventUnread(
  eventId: string,
): Promise<{ status: number; data: { ok: true } | ApiError }> {
  return request("/api/live-events/unread", { method: "POST", body: { eventId } });
}

/** 按类型全部已读（admin 及以上，水位线只前进不后退）。 */
export async function markAllLiveEventsRead(
  type: ReadAllType,
): Promise<{ status: number; data: { ok: true; marked: number } | ApiError }> {
  return request("/api/live-events/read-all", { method: "POST", body: { type } });
}
