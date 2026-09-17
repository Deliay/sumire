/**
 * 内网直播事件服务客户端（base URL 经 config.liveEventsUpstreamUrl 注入）。
 * - fetchRange：GET {base}/api/b/live/1727076670/event/range（多 type= 重复参数，5s 超时兜底）；
 * - subscribe：GET {base}/api/b/live/1727076670/event/subscribe（SSE 逐行解析，AbortController 中止）。
 * fetch 可注入便于单测（照 routes/liveHistory 的 fetchFn 范式）。
 *
 * **实测结论（2026-09-17）**：上游 `event/range` **不支持任何时间区间参数**——传
 * ISO8601（`start`/`end`）或 epoch 秒均被忽略、原样返回最新一页；分页按 `occurredAt`
 * **倒序**且 `total` 可靠（单类型 danmaku 可达 ~79 万）；`pageSize` 上限为 **100**
 * （传 1000 被钳到 100）。故回放取数不走时间参数透传，改由路由层
 * `scanReplayEvents` 二分定位 + 定向扫描兜底（见 `routes/liveEvents.ts`）。
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
  fetchRange(types: string[], page: number, pageSize: number, minPrice?: number): Promise<UpstreamPage>;
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

export function buildRangeUrl(base: string, types: string[], page: number, pageSize: number, minPrice?: number): string {
  const url = buildUrl(base, "/event/range", types);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  if (minPrice !== undefined && minPrice > 0) url.searchParams.set("minPrice", String(minPrice));
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
    async fetchRange(types, page, pageSize, minPrice?) {
      const res = await fetchImpl(buildRangeUrl(baseUrl, types, page, pageSize, minPrice), {
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
