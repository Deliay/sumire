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
 * 裁剪上游响应：仅透传 title/startDate/stopDate 三字段，缺 title 或 startDate 丢弃，
 * 按 startDate 倒序取前 100 条。非数组直接返回空数组（由调用方按失败处理）。
 */
export function normalizeRecords(input: unknown): LiveRecord[] {
  if (!Array.isArray(input)) return [];
  const out: LiveRecord[] = [];
  for (const item of input) {
    if (!isLiveRecord(item)) continue;
    const rec: LiveRecord = { title: item.title, startDate: item.startDate };
    if (typeof item.stopDate === "string") rec.stopDate = item.stopDate;
    out.push(rec);
  }
  return out.sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, MAX_RECORDS);
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
      const upstream = await fetchFn(deps.upstreamUrl, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);
      const json = (await upstream.json()) as unknown;
      if (!Array.isArray(json)) throw new Error("upstream response is not an array");
      const records = normalizeRecords(json);
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
