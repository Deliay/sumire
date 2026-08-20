import { request, type ApiError } from "@/features/backdoor/api";
import type { LiveEvent } from "../types";

export interface SearchLiveEventsPage {
  total: number;
  page: number;
  pageSize: number;
  items: LiveEvent[];
}

/** 按关键词检索直播事件（member 及以上）。 */
export async function searchLiveEvents(
  stringCriteria: string,
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<{ status: number; data: SearchLiveEventsPage | ApiError }> {
  const params = new URLSearchParams();
  params.set("stringCriteria", stringCriteria);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return request(`/api/live-events/search?${params.toString()}`, { signal });
}
