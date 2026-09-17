/**
 * 内网直播事件服务客户端（base URL 经 config.liveEventsUpstreamUrl 注入）。
 * - fetchRange：GET {base}/api/b/live/{roomId}/event/range（多 type= 重复参数，5s 超时兜底）；
 * - subscribe：GET {base}/api/b/live/{roomId}/event/subscribe（SSE 逐行解析，AbortController 中止）。
 * fetch 可注入便于单测（照 routes/liveHistory 的 fetchFn 范式）。
 *
 * roomId 作为**路径段**拼接（`/api/b/live/{roomId}/...`），base 不变、无 SSRF 面；仅接受
 * 正整数。后台看板端点（range/search/subscribe）不传 roomId，缺省固定枝堇直播间
 * `DEFAULT_ROOM_ID`；公开回放端点按录播所属直播间显式传入。
 *
 * **实测结论（2026-09-17）**：上游 `event/range` **原生支持时间区间查询**，参数名为
 * `startedAt`/`endedAt`（ISO8601）；过滤与分页正交——同区间 `page=1/page=2` 的 `total`
 * 均为区间内计数且各自返回对应页；支持开放端（仅传 `startedAt` 按下界过滤）。分页按
 * `occurredAt` **倒序**，`pageSize` 上限为 **100**（传 1000 被钳到 100）。
 *
 * ⚠️ 易错点：传 `start`/`end`（ISO8601 或 epoch）会被上游**忽略**、原样返回最新一页
 * （`total` 为全量），此前「上游不支持时间参数」的误判即源于参数名用错。回放取数必须
 * 使用 `startedAt`/`endedAt`。
 */

/** 后台看板默认直播间（枝堇）；公开回放按录播所属房间显式传入。 */
export const DEFAULT_ROOM_ID = 1727076670;
const EVENT_API_BASE = "/api/b/live";
const UPSTREAM_TIMEOUT_MS = 5000;

/** roomId → 上游事件路径前缀；仅接受正整数（路径段拼接，防非法注入）。 */
function eventApiPrefix(roomId: number): string {
  if (!Number.isInteger(roomId) || roomId <= 0) {
    throw new Error("roomId 必须为正整数");
  }
  return `${EVENT_API_BASE}/${roomId}`;
}

/** 上游统一信封：payload 为 B 站原始 cmd 对象，结构由 normalize 层负责。 */
export interface UpstreamEnvelope {
  roomId?: number;
  type?: string;
  occurredAt?: string;
  liveSessionId?: string;
  payload?: unknown;
}

export interface UpstreamPage {
  total: number;
  page: number;
  pageSize: number;
  items: UpstreamEnvelope[];
}

export type LiveEventHandler = (envelope: UpstreamEnvelope) => void | Promise<void>;

export interface LiveEventsUpstream {
  /**
   * 分页检索；`startedAt`/`endedAt`（ISO8601）为上游时间区间参数（实测支持，过滤后分页、total 为区间计数）。
   * `roomId` 为上游路径段，缺省 `DEFAULT_ROOM_ID`（后台看板）；公开回放显式传入录播所属房间。
   */
  fetchRange(
    types: string[],
    page: number,
    pageSize: number,
    minPrice?: number,
    startedAt?: string,
    endedAt?: string,
    roomId?: number,
  ): Promise<UpstreamPage>;
  /** 按关键词检索事件：代理上游 event/search。 */
  search(params: { stringCriteria: string; page: number; pageSize: number }): Promise<UpstreamPage>;
  /** SSE 订阅：逐事件回调；流正常结束或出错时返回/抛出（由调用方决定是否重连）。 */
  subscribe(types: string[], onEvent: LiveEventHandler, signal: AbortSignal): Promise<void>;
}

function buildUrl(base: string, path: string, types: string[], roomId: number = DEFAULT_ROOM_ID): URL {
  const url = new URL(`${base.replace(/\/+$/, "")}${eventApiPrefix(roomId)}${path}`);
  for (const t of types) url.searchParams.append("type", t);
  return url;
}

export function buildRangeUrl(
  base: string,
  types: string[],
  page: number,
  pageSize: number,
  minPrice?: number,
  startedAt?: string,
  endedAt?: string,
  roomId?: number,
): string {
  const url = buildUrl(base, "/event/range", types, roomId);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  if (minPrice !== undefined && minPrice > 0) url.searchParams.set("minPrice", String(minPrice));
  // 上游时间过滤参数名为 startedAt/endedAt（传 start/end 会被忽略）
  if (startedAt) url.searchParams.set("startedAt", startedAt);
  if (endedAt) url.searchParams.set("endedAt", endedAt);
  return url.toString();
}

export function buildSubscribeUrl(base: string, types: string[], roomId?: number): string {
  return buildUrl(base, "/event/subscribe", types, roomId).toString();
}

export function buildSearchUrl(
  base: string,
  params: { stringCriteria: string; page: number; pageSize: number },
  roomId?: number,
): string {
  const url = new URL(`${base.replace(/\/+$/, "")}${eventApiPrefix(roomId ?? DEFAULT_ROOM_ID)}/event/search`);
  url.searchParams.set("stringCriteria", params.stringCriteria);
  url.searchParams.set("page", String(params.page));
  url.searchParams.set("pageSize", String(params.pageSize));
  return url.toString();
}

/** 校验上游分页信封：items 必须是数组。 */
function parsePage(json: unknown, page: number, pageSize: number): UpstreamPage {
  const rec = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : null;
  if (!rec || !Array.isArray(rec.items)) {
    throw new Error("上游事件响应非法（缺 items 数组）");
  }
  return {
    total: typeof rec.total === "number" ? rec.total : rec.items.length,
    page: typeof rec.page === "number" ? rec.page : page,
    pageSize: typeof rec.pageSize === "number" ? rec.pageSize : pageSize,
    items: rec.items as UpstreamEnvelope[],
  };
}

export function createLiveEventsUpstream(baseUrl: string, fetchFn?: typeof fetch): LiveEventsUpstream {
  const fetchImpl = fetchFn ?? fetch;

  return {
    async fetchRange(types, page, pageSize, minPrice?, startedAt?, endedAt?, roomId?) {
      const res = await fetchImpl(buildRangeUrl(baseUrl, types, page, pageSize, minPrice, startedAt, endedAt, roomId), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`upstream status ${res.status}`);
      return parsePage(await res.json(), page, pageSize);
    },

    async search({ stringCriteria, page, pageSize }) {
      const res = await fetchImpl(buildSearchUrl(baseUrl, { stringCriteria, page, pageSize }), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`upstream status ${res.status}`);
      return parsePage(await res.json(), page, pageSize);
    },

    async subscribe(types, onEvent, signal) {
      const res = await fetchImpl(buildSubscribeUrl(baseUrl, types), {
        signal,
        headers: { Accept: "text/event-stream" },
      });
      if (!res.ok) throw new Error(`upstream status ${res.status}`);
      if (!res.body) throw new Error("上游订阅响应无 body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // reader.read() 不感知外部 AbortSignal（如被注入的流），race 一个中止兜底
      const aborted = new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("订阅已中止")), { once: true });
      });
      try {
        for (;;) {
          if (signal.aborted) return;
          const { done, value } = await Promise.race([reader.read(), aborted]);
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue; // 跳过注释/心跳/事件名行
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              await onEvent(JSON.parse(data) as UpstreamEnvelope);
            } catch (err) {
              console.warn("[liveEvents] 上游 SSE 帧解析失败，已跳过:", err instanceof Error ? err.message : err);
            }
          }
        }
      } catch (err) {
        // AbortController 中止属正常退出（客户端断开），其余错误上抛由调用方退避重连
        if (signal.aborted) return;
        throw err;
      } finally {
        reader.releaseLock();
      }
    },
  };
}
