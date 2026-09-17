/**
 * 录播回放事件公开客户端。
 *
 * 基址取 `NEXT_PUBLIC_API_BASE_URL`（与后台 API 同源），但**不携带凭据**——
 * replay 端点为匿名可读的公开端点。请求失败/非 200 一律静默降级，
 * 调用方据此渲染事件区错误态。
 *
 * replay 端点不下发 `read` 与罗马音字段（公开语义），解析后统一补 `read: false`
 * 并补齐可选 sender 字段，以复用 `features/danmaku/types.ts` 的 zod schema 与条目组件。
 */

import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";
import { LiveEventSchema, type LiveEvent, type LiveEventType } from "@/features/danmaku/types";

export interface ReplayEventsResult {
  ok: boolean;
  total: number;
  items: LiveEvent[];
}

export interface FetchReplayEventsParams {
  /** 直播间 ID（正整数，必填）：回放事件按录播所属房间检索，避免串到其它直播间。 */
  roomId: number;
  start: string;
  end: string;
  types?: LiveEventType[];
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

/** 把 replay 端点条目归一化为可喂给弹幕条目组件的 LiveEvent。 */
function parseReplayEvent(raw: unknown): LiveEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const sender = item.sender && typeof item.sender === "object" ? (item.sender as Record<string, unknown>) : {};
  const parsed = LiveEventSchema.safeParse({
    ...item,
    read: false,
    sender: { nameRomaji: null, guardLevel: null, ...sender },
  });
  return parsed.success ? parsed.data : null;
}

/**
 * 按直播间与时间区间检索回放事件（公开）。窗口化由调用方负责切分 start/end。
 * `roomId` 必填，透传查询串；未配置基址/非 200/异常均返回 `{ ok: false, total: 0, items: [] }`。
 */
export async function fetchReplayEvents(params: FetchReplayEventsParams): Promise<ReplayEventsResult> {
  if (!API_CONFIGURED) return { ok: false, total: 0, items: [] };
  const search = new URLSearchParams();
  search.set("roomId", String(params.roomId));
  search.set("start", params.start);
  search.set("end", params.end);
  for (const type of params.types ?? []) search.append("type", type);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));

  try {
    const base = API_BASE_URL.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/live-events/replay?${search.toString()}`, {
      signal: params.signal,
    });
    if (res.status !== 200) return { ok: false, total: 0, items: [] };
    const data = (await res.json()) as { total?: unknown; items?: unknown };
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const items = rawItems.map(parseReplayEvent).filter((item): item is LiveEvent => item !== null);
    const total = typeof data?.total === "number" ? data.total : items.length;
    return { ok: true, total, items };
  } catch {
    return { ok: false, total: 0, items: [] };
  }
}
