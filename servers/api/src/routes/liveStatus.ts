import { Router, type Request, type Response } from "express";
import type { LiveStatusCache } from "../infra/liveStatusCache";

export const LIVE_STATUS_CACHE_KEY = "live-status:latest";
export const LIVE_STATUS_CACHE_TTL_SECONDS = 30;
const UPSTREAM_TIMEOUT_MS = 5000;

/** 归一化直播状态。live 为唯一强保证字段；title/startedAt 上游缺字段时为 null。 */
export interface LiveStatus {
  live: boolean;
  title: string | null;
  startedAt: string | null;
}

/**
 * 从上游响应防御式提取字符串字段：仅透传非空字符串，否则返回 null。
 * 兼容常见字段名（title/room_info.title、startedAt/startTime/live_start_time 等），
 * 上游真实结构以实现阶段实测为准并回写契约/spec。
 */
function optionalStr(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickStr(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = optionalStr(source[key]);
    if (v !== null) return v;
  }
  return null;
}

/**
 * 从上游响应提取直播状态布尔。兼容：
 * - 顶层/嵌套 `live`（boolean）；
 * - 顶层/嵌套 `live_status` / `is_live` / `status`（1=true，0=false，number/string 均接受）。
 * 无法确定为布尔时返回 null（由调用方按失败处理）。
 */
function extractLive(input: unknown): boolean | null {
  const candidates: unknown[] = [input];
  if (typeof input === "object" && input !== null) {
    const room = (input as { room_info?: unknown }).room_info;
    if (typeof room === "object" && room !== null) candidates.push(room);
    const data = (input as { data?: unknown }).data;
    if (typeof data === "object" && data !== null) candidates.push(data);
  }
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const o = candidate as Record<string, unknown>;
    for (const key of ["live", "is_live", "liveStatus"]) {
      if (typeof o[key] === "boolean") return o[key] as boolean;
    }
    for (const key of ["live_status", "status"]) {
      const v = o[key];
      if (v === 1 || v === "1") return true;
      if (v === 0 || v === "0") return false;
    }
  }
  return null;
}

/**
 * 防御式归一化：成功返回 LiveStatus；结构非法（无法确定 live 布尔）返回 null（按上游失败处理）。
 */
export function normalizeLiveStatus(input: unknown): LiveStatus | null {
  if (typeof input !== "object" || input === null) return null;
  const live = extractLive(input);
  if (live === null) return null;
  const o = input as Record<string, unknown>;
  const room =
    typeof o.room_info === "object" && o.room_info !== null
      ? (o.room_info as Record<string, unknown>)
      : null;
  const data =
    typeof o.data === "object" && o.data !== null ? (o.data as Record<string, unknown>) : null;
  const title =
    pickStr(o, ["title"]) ??
    (room ? pickStr(room, ["title"]) : null) ??
    (data ? pickStr(data, ["title"]) : null);
  const startedAt =
    pickStr(o, ["startedAt", "startTime", "live_start_time", "liveStartTime", "createdAt"]) ??
    (room ? pickStr(room, ["startedAt", "startTime", "live_start_time", "liveStartTime", "createdAt"]) : null) ??
    (data ? pickStr(data, ["startedAt", "startTime", "live_start_time", "liveStartTime", "createdAt"]) : null);
  return { live, title, startedAt };
}

export interface LiveStatusRouterDeps {
  upstreamUrl: string;
  cache: LiveStatusCache;
  /** 可注入的上游 fetch（单测打桩），缺省用全局 fetch。 */
  fetchFn?: typeof fetch;
}

/**
 * GET /api/live/status（公开读）：Redis 短 TTL 缓存 → 未命中拉上游（5s 超时）→
 * 防御式归一化 → 写缓存返回；上游失败时 stale-if-error，否则 200 降级体。永不 5xx。
 */
export function createLiveStatusRouter(deps: LiveStatusRouterDeps): Router {
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

  router.get("/", async (_req: Request, res: Response) => {
    const cached = await deps.cache.get(LIVE_STATUS_CACHE_KEY);
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
      const status = normalizeLiveStatus(json);
      if (status === null) throw new Error("上游响应无法归一化为直播状态");
      const body = { ok: true, status };
      await deps.cache.set(LIVE_STATUS_CACHE_KEY, JSON.stringify(body), LIVE_STATUS_CACHE_TTL_SECONDS);
      res.status(200).json(body);
      return;
    } catch {
      // stale-if-error：失败时重读缓存（并发窗口内他人写入的可用值）
      const stale = await deps.cache.get(LIVE_STATUS_CACHE_KEY);
      if (stale !== null) {
        sendCached(res, stale);
        return;
      }
      res.status(200).json({ ok: false, status: null });
    }
  });

  return router;
}