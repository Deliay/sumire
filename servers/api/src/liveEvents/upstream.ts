/**
 * 内网直播事件服务客户端（base URL 经 config.liveEventsUpstreamUrl 注入）。
 * - fetchRange：GET {base}/api/b/live/1727076670/event/range（多 type= 重复参数，5s 超时兜底）；
 * - subscribe：GET {base}/api/b/live/1727076670/event/subscribe（SSE 逐行解析，AbortController 中止）。
 * fetch 可注入便于单测（照 routes/liveHistory 的 fetchFn 范式）。
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

const EVENT_API_PREFIX = "/api/b/live/1727076670";
const UPSTREAM_TIMEOUT_MS = 5000;

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
  /** 分页检索；`startedAt`/`endedAt`（ISO8601）为上游时间区间参数（实测支持，过滤后分页、total 为区间计数）。 */
  fetchRange(
    types: string[],
    page: number,
    pageSize: number,
    minPrice?: number,
    startedAt?: string,
    endedAt?: string,
  ): Promise<UpstreamPage>;
  /** 按关键词检索事件：代理上游 event/search。 */
  search(params: { stringCriteria: string; page: number; pageSize: number }): Promise<UpstreamPage>;
  /** SSE 订阅：逐事件回调；流正常结束或出错时返回/抛出（由调用方决定是否重连）。 */
  subscribe(types: string[], onEvent: LiveEventHandler, signal: AbortSignal): Promise<void>;
}

function buildUrl(base: string, path: string, types: string[]): URL {
  const url = new URL(`${base.replace(/\/+$/, "")}${EVENT_API_PREFIX}${path}`);
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
): string {
  const url = buildUrl(base, "/event/range", types);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  if (minPrice !== undefined && minPrice > 0) url.searchParams.set("minPrice", String(minPrice));
  // 上游时间过滤参数名为 startedAt/endedAt（传 start/end 会被忽略）
  if (startedAt) url.searchParams.set("startedAt", startedAt);
  if (endedAt) url.searchParams.set("endedAt", endedAt);
  return url.toString();
}

export function buildSubscribeUrl(base: string, types: string[]): string {
  return buildUrl(base, "/event/subscribe", types).toString();
}

export function buildSearchUrl(base: string, params: { stringCriteria: string; page: number; pageSize: number }): string {
  const url = new URL(`${base.replace(/\/+$/, "")}${EVENT_API_PREFIX}/event/search`);
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
    async fetchRange(types, page, pageSize, minPrice?, startedAt?, endedAt?) {
      const res = await fetchImpl(buildRangeUrl(baseUrl, types, page, pageSize, minPrice, startedAt, endedAt), {
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
