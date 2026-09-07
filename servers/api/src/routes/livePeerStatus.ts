import { Router, type Request, type Response } from "express";
import type { LiveStatusCache } from "../infra/liveStatusCache";
import { normalizeLiveStatus, LIVE_STATUS_CACHE_TTL_SECONDS, type LiveStatus } from "./liveStatus";

const UPSTREAM_TIMEOUT_MS = 5000;

/** 同期主播白名单映射：name → roomId（服务端内置，不暴露）。 */
const PEER_ROOMS: Record<string, string> = {
  viridis: "1727071052",
  komichi: "1700301235",
  chu2u: "1727074031",
};

export interface LivePeerStatusRouterDeps {
  upstreamBaseUrl: string;
  cache: LiveStatusCache;
  /** 可注入的上游 fetch（单测打桩），缺省用全局 fetch。 */
  fetchFn?: typeof fetch;
}

/**
 * GET /api/live/:name/status（公开读）：白名单校验 → Redis 短 TTL 缓存（按 name 隔离）→
 * 未命中拉上游（5s 超时）→ 防御式归一化 → 写缓存返回；上游失败时 stale-if-error，
 * 否则 200 降级体。永不 5xx。
 */
export function createLivePeerStatusRouter(deps: LivePeerStatusRouterDeps): Router {
  const router = Router();
  const fetchFn = deps.fetchFn ?? fetch;

  function sendCached(res: Response, raw: string): void {
    try {
      const parsed = JSON.parse(raw) as { ok: boolean; status: LiveStatus | null };
      res.status(200).json(parsed);
    } catch {
      // 缓存内容非法按无缓存处理
      res.status(200).json({ ok: false, status: null });
    }
  }

  router.get("/:name/status", async (req: Request, res: Response) => {
    const name = String(req.params.name);
    const roomId = PEER_ROOMS[name];
    if (roomId === undefined) {
      res.status(404).json({ error: "未知的同期主播" });
      return;
    }

    const cacheKey = `live-peer-status:${name}`;
    const cached = await deps.cache.get(cacheKey);
    if (cached !== null) {
      sendCached(res, cached);
      return;
    }

    try {
      const upstream = await fetchFn(`${deps.upstreamBaseUrl}/api/b/live/${roomId}/state/current`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) throw new Error(`upstream status ${upstream.status}`);
      const json = (await upstream.json()) as unknown;
      const status = normalizeLiveStatus(json);
      if (status === null) throw new Error("上游响应无法归一化为直播状态");
      const body = { ok: true, status };
      await deps.cache.set(cacheKey, JSON.stringify(body), LIVE_STATUS_CACHE_TTL_SECONDS);
      res.status(200).json(body);
      return;
    } catch {
      // stale-if-error：失败时重读缓存（并发窗口内他人写入的可用值）
      const stale = await deps.cache.get(cacheKey);
      if (stale !== null) {
        sendCached(res, stale);
        return;
      }
      res.status(200).json({ ok: false, status: null });
    }
  });

  return router;
}
