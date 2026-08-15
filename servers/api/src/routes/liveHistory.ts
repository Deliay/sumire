import { Router, type Request, type Response } from "express";
import type { LiveHistoryCache } from "../infra/liveHistoryCache";

export interface LiveRecord {
  title: string;
  startDate: string;
  stopDate?: string;
}

export const LIVE_HISTORY_CACHE_KEY = "live-history:latest";
export const LIVE_HISTORY_CACHE_TTL_SECONDS = 300;
const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_RECORDS = 100;

/** 单条记录合法性：必须是对象，且 title、startDate 为非空字符串。 */
export function isLiveRecord(value: unknown): value is LiveRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return typeof r.title === "string" && r.title.length > 0 && typeof r.startDate === "string" && r.startDate.length > 0;
}

/**
 * 从上游响应提取记录数组：兼容分页信封 `{ total, page, pageSize, items: [...] }` 与裸数组两种形态。
 * 既非数组、也非含数组 items 的信封时返回 null（由调用方按失败处理）。
 */
export function extractItems(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (typeof input === "object" && input !== null) {
    const items = (input as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return null;
}

/**
 * 裁剪记录列表：仅透传 title/startDate/stopDate 三字段，缺 title 或 startDate 丢弃，
 * 按 startDate 倒序取前 100 条。
 */
export function normalizeRecords(list: unknown[]): LiveRecord[] {
  const out: LiveRecord[] = [];
  for (const item of list) {
    if (!isLiveRecord(item)) continue;
    const rec: LiveRecord = { title: item.title, startDate: item.startDate };
    if (typeof item.stopDate === "string") rec.stopDate = item.stopDate;
    out.push(rec);
  }
  return out.sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, MAX_RECORDS);
}

/** 上游取数 URL：追加 `page=1&pageSize=100`（兼容上游已带查询串），保证一次拿到最多 100 条。 */
export function buildUpstreamUrl(base: string): string {
  const url = new URL(base);
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "100");
  return url.toString();
}

export interface LiveHistoryRouterDeps {
  upstreamUrl: string;
  cache: LiveHistoryCache;
  /** 可注入的上游 fetch（单测打桩），缺省用全局 fetch。 */
  fetchFn?: typeof fetch;
}

/**
 * GET /api/live-history（公开读）：Redis 短 TTL 缓存 → 未命中拉上游（5s 超时）→
 * 裁剪三字段 + 倒序取 100 条 → 写缓存返回；上游失败时 stale-if-error，否则降级体。
 */
export function createLiveHistoryRouter(deps: LiveHistoryRouterDeps): Router {
  const router = Router();
  const fetchFn = deps.fetchFn ?? fetch;

  function sendCached(res: Response, raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { ok: boolean; records: LiveRecord[] };
      res.status(200).json(parsed);
    } catch {
      // 缓存内容非法按无缓存处理
      res.status(200).json({ ok: false, records: [] });
    }
  }

  router.get("/", async (_req: Request, res: Response) => {
    const cached = await deps.cache.get(LIVE_HISTORY_CACHE_KEY);
    if (cached !== null) {
      sendCached(res, cached);
      return;
    }

    try {
      const upstream = await fetchFn(buildUpstreamUrl(deps.upstreamUrl), {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);
      const json = (await upstream.json()) as unknown;
      const list = extractItems(json);
      if (list === null) throw new Error("上游响应既非数组也非分页信封");
      const records = normalizeRecords(list);
      const body = { ok: true, records };
      await deps.cache.set(LIVE_HISTORY_CACHE_KEY, JSON.stringify(body), LIVE_HISTORY_CACHE_TTL_SECONDS);
      res.status(200).json(body);
      return;
    } catch {
      // stale-if-error：失败时重读缓存（并发窗口内他人写入的可用值）
      const stale = await deps.cache.get(LIVE_HISTORY_CACHE_KEY);
      if (stale !== null) {
        sendCached(res, stale);
        return;
      }
      res.status(200).json({ ok: false, records: [] });
    }
  });

  return router;
}
