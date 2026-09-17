import { Router, type Request, type Response } from "express";
import { requireRole } from "../rbac/requireRole";
import { toLiveEvent, type LiveEvent, type LiveEventSender, type LiveEventType } from "../liveEvents/normalize";
import { toRomaji } from "../liveEvents/romaji";
import type { LiveEventsUpstream, UpstreamEnvelope } from "../liveEvents/upstream";
import { markRead, markUnread, markAllRead, resolveReadState, typeFromEventId } from "../db/liveEventReads";
import { createMemoryLiveEventsReplayCache, type LiveEventsReplayCache } from "../infra/liveEventsReplayCache";

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = ["danmaku", "super_chat", "gift", "guard_buy"];
/** 直接透传、不做 toLiveEvent 归一化的类型。 */
export const PASSTHROUGH_TYPES: readonly string[] = ["online_rank_count"];
/** 「全部已读」仅支持需要已读管理的类型（契约口径）。 */
const READ_ALL_TYPES: readonly string[] = ["super_chat", "guard_buy", "gift"];

const HEARTBEAT_MS = 30_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const READ_ALL_PAGE_SIZE = 100;

/** 回放区间上限（契约：end - start ≤ 12h）。 */
const REPLAY_MAX_RANGE_MS = 12 * 60 * 60 * 1000;
/** 回放缓存 TTL（历史区间不可变，缓存安全）。 */
const REPLAY_CACHE_TTL_SECONDS = 300;
/** 回放扫描每次请求上游的页大小。 */
const REPLAY_SCAN_PAGE_SIZE = 100;
/** 回放扫描页数上限（≈5000 条），超出截断并如实返回已扫描口径 total。 */
const REPLAY_SCAN_MAX_PAGES = 50;

export interface LiveEventsRouterDeps {
  upstream: LiveEventsUpstream;
  /** 文本 → 罗马音标注（缺省用 kuroshiro 全文转换；单测可注入恒 null 或以 text 取巧）。 */
  toRomajiFn?: (text: string) => Promise<string | null>;
  /** SSE 心跳间隔（缺省 30s，单测可调小）。 */
  heartbeatMs?: number;
  /** 上游断流重连退避：起步 1s，倍增至 30s 上限（单测可调小）。 */
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  /** 回放事件缓存（缺省内存实现，生产由 index.ts 注入 Redis 实现）。 */
  replayCache?: LiveEventsReplayCache;
}

/** 回放事件投影：剔除 read 与罗马音字段（不直接透传内部 LiveEvent，避免误带后台语义）。 */
export interface ReplayEventSender {
  uid: number;
  name: string;
  face: string | null;
  medal: LiveEventSender["medal"];
  guardLevel: number | null;
}

export interface ReplayEvent {
  eventId: string;
  type: LiveEventType;
  occurredAt: string;
  sender: ReplayEventSender;
  content?: string;
  emote?: LiveEvent["emote"];
  price?: number;
  scColors?: LiveEvent["scColors"];
  time?: number;
  gift?: LiveEvent["gift"];
  guard?: LiveEvent["guard"];
}

export interface ReplayPage {
  total: number;
  page: number;
  pageSize: number;
  items: ReplayEvent[];
}

/** LiveEvent → ReplayEvent：显式构造投影，绝不透传 read/nameRomaji/contentRomaji。 */
function toReplayEvent(e: LiveEvent): ReplayEvent {
  return {
    eventId: e.eventId,
    type: e.type,
    occurredAt: e.occurredAt,
    sender: {
      uid: e.sender.uid,
      name: e.sender.name,
      face: e.sender.face,
      medal: e.sender.medal,
      guardLevel: e.sender.guardLevel,
    },
    ...(e.content !== undefined ? { content: e.content } : {}),
    ...(e.emote !== undefined ? { emote: e.emote } : {}),
    ...(e.price !== undefined ? { price: e.price } : {}),
    ...(e.scColors !== undefined ? { scColors: e.scColors } : {}),
    ...(e.time !== undefined ? { time: e.time } : {}),
    ...(e.gift !== undefined ? { gift: e.gift } : {}),
    ...(e.guard !== undefined ? { guard: e.guard } : {}),
  };
}

/** ISO 时间参数：非字符串或无法解析 → null（由调用方 400）。 */
function parseTimeParam(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * 服务端分页扫描兜底：上游 event/range 按 occurredAt 倒序返回，
 * 自 page=1 起翻页收集 [start,end] 内事件，遇到 occurredAt < start 立即终止
 * （倒序保证其后含后续页全部越界），扫描页数上限 50 页。
 */
async function scanReplayEvents(
  upstream: LiveEventsUpstream,
  upstreamTypes: string[],
  startMs: number,
  endMs: number,
): Promise<LiveEvent[]> {
  const collected: LiveEvent[] = [];
  for (let page = 1; page <= REPLAY_SCAN_MAX_PAGES; page++) {
    const upstreamPage = await upstream.fetchRange(upstreamTypes, page, REPLAY_SCAN_PAGE_SIZE);
    let reachedBeforeStart = false;
    for (const item of upstreamPage.items) {
      const raw = typeof item.occurredAt === "string" ? new Date(item.occurredAt).getTime() : NaN;
      if (!Number.isNaN(raw) && raw < startMs) {
        reachedBeforeStart = true;
        break;
      }
      const event = toLiveEvent(item);
      if (!event) continue;
      const t = new Date(event.occurredAt).getTime();
      if (t >= startMs && t <= endMs) collected.push(event);
    }
    if (reachedBeforeStart) break;
    if (upstreamPage.items.length < REPLAY_SCAN_PAGE_SIZE) break;
  }
  collected.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  return collected;
}

/** type 查询参数：可重复，缺省为全部四类；含非法值则整体 400。 */
function parseTypesParam(value: unknown, extraTypes?: readonly string[]): { ok: boolean; types: string[] } {
  const allowed = extraTypes ? [...LIVE_EVENT_TYPES, ...extraTypes] : [...LIVE_EVENT_TYPES];
  if (value === undefined) return { ok: true, types: [...LIVE_EVENT_TYPES] };
  const list = Array.isArray(value) ? value : [value];
  const types: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || !allowed.includes(v)) {
      return { ok: false, types: [] };
    }
    types.push(v);
  }
  return { ok: true, types };
}

/** 契约 type → 上游 type 查询参数：gift 并入 gift_v2 来源（前端透明）。 */
function toUpstreamTypes(types: string[]): string[] {
  return types.flatMap((t) => (t === "gift" ? ["gift", "gift_v2"] : [t]));
}

/** 分页参数：缺省回退 fallback；非正整数或超过 max 返回 null（由调用方 400）。 */
function parsePageParam(value: unknown, fallback: number, max?: number): number | null {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || (max !== undefined && n > max)) return null;
  return n;
}

/** minPrice 参数：undefined 不筛选；非有限数字/负数/超上限 100 返回 null（由调用方 400）。 */
function parseMinPriceParam(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n > 0 ? n : undefined;
}

function upstreamUnavailable(res: Response, err: unknown): void {
  console.warn("[liveEvents] 上游事件服务不可用:", err instanceof Error ? err.message : err);
  res.status(502).json({ error: "上游事件服务不可用" });
}

/** 信封 → 归一化 LiveEvent（过滤无法识别的事件，不中断）。 */
function normalizeAll(items: UpstreamEnvelope[]): LiveEvent[] {
  return items.map(toLiveEvent).filter((e): e is LiveEvent => e !== null);
}

/** 为事件填充罗马音标注：昵称（sender.nameRomaji）与 SC 留言（contentRomaji）。 */
async function annotateRomaji(
  events: LiveEvent[],
  toRomajiFn: (text: string) => Promise<string | null>,
): Promise<LiveEvent[]> {
  return Promise.all(
    events.map(async (e) => {
      const nameRomaji = await toRomajiFn(e.sender.name);
      const contentRomaji =
        e.type === "super_chat" && e.content !== undefined ? await toRomajiFn(e.content) : null;
      return {
        ...e,
        sender: { ...e.sender, nameRomaji },
        ...(contentRomaji ? { contentRomaji } : {}),
      };
    }),
  );
}

export function createLiveEventsRouter(deps: LiveEventsRouterDeps): Router {
  const router = Router();
  const toRomajiFn = deps.toRomajiFn ?? toRomaji;
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  const backoffInitialMs = deps.backoffInitialMs ?? BACKOFF_INITIAL_MS;
  const backoffMaxMs = deps.backoffMaxMs ?? BACKOFF_MAX_MS;
  const replayCache = deps.replayCache ?? createMemoryLiveEventsReplayCache();

  // GET /api/live-events/replay —— 录播回放事件检索（公开，无需登录）
  router.get("/replay", async (req: Request, res: Response) => {
    const startMs = parseTimeParam(req.query.start);
    const endMs = parseTimeParam(req.query.end);
    if (startMs === null || endMs === null) {
      res.status(400).json({ error: "start/end 时间参数非法" });
      return;
    }
    if (endMs <= startMs) {
      res.status(400).json({ error: "end 必须晚于 start" });
      return;
    }
    if (endMs - startMs > REPLAY_MAX_RANGE_MS) {
      res.status(400).json({ error: "时间区间不能超过 12 小时" });
      return;
    }
    const types = parseTypesParam(req.query.type);
    if (!types.ok) {
      res.status(400).json({ error: "type 参数非法" });
      return;
    }
    const page = parsePageParam(req.query.page, 1);
    const pageSize = parsePageParam(req.query.pageSize, 100, 100);
    if (page === null || pageSize === null) {
      res.status(400).json({ error: "分页参数非法" });
      return;
    }

    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(endMs).toISOString();
    const cacheKey = `live-events:replay:${startIso}:${endIso}:${types.types.join(",")}:${page}:${pageSize}`;
    try {
      const cached = await replayCache.get(cacheKey);
      if (cached !== null) {
        res.status(200).json(JSON.parse(cached) as ReplayPage);
        return;
      }
    } catch (err) {
      console.warn("[liveEvents] 回放缓存读取失败:", err instanceof Error ? err.message : err);
    }

    let collected: LiveEvent[];
    try {
      collected = await scanReplayEvents(deps.upstream, toUpstreamTypes(types.types), startMs, endMs);
    } catch (err) {
      upstreamUnavailable(res, err);
      return;
    }

    const result: ReplayPage = {
      total: collected.length,
      page,
      pageSize,
      items: collected.slice((page - 1) * pageSize, page * pageSize).map(toReplayEvent),
    };
    try {
      await replayCache.set(cacheKey, JSON.stringify(result), REPLAY_CACHE_TTL_SECONDS);
    } catch (err) {
      console.warn("[liveEvents] 回放缓存写入失败:", err instanceof Error ? err.message : err);
    }
    res.status(200).json(result);
  });

  // GET /api/live-events —— 历史事件检索（member 及以上）
  router.get("/", requireRole("member"), async (req: Request, res: Response) => {
    const types = parseTypesParam(req.query.type, PASSTHROUGH_TYPES);
    if (!types.ok) {
      res.status(400).json({ error: "type 参数非法" });
      return;
    }
    const page = parsePageParam(req.query.page, 1);
    const pageSize = parsePageParam(req.query.pageSize, 50, 100);
    const minPrice = parseMinPriceParam(req.query.minPrice);
    if (page === null || pageSize === null || minPrice === null) {
      res.status(400).json({ error: "分页参数非法" });
      return;
    }
    let upstreamPage;
    const upstreamTypes = toUpstreamTypes(types.types);
    try {
      upstreamPage = minPrice !== undefined
        ? await deps.upstream.fetchRange(upstreamTypes, page, pageSize, minPrice)
        : await deps.upstream.fetchRange(upstreamTypes, page, pageSize);
    } catch (err) {
      upstreamUnavailable(res, err);
      return;
    }
    const passthroughSet = new Set(PASSTHROUGH_TYPES);
    const liveEvents: LiveEvent[] = [];
    const passthroughItems: UpstreamEnvelope[] = [];
    for (const item of upstreamPage.items) {
      if (item.type && passthroughSet.has(item.type)) {
        passthroughItems.push(item);
      } else {
        const event = toLiveEvent(item);
        if (event) liveEvents.push(event);
      }
    }
    const resolved = await resolveReadState(liveEvents);
    const annotated = await annotateRomaji(resolved, toRomajiFn);
    res.status(200).json({
      total: upstreamPage.total,
      page: upstreamPage.page,
      pageSize: upstreamPage.pageSize,
      items: [...annotated, ...passthroughItems],
    });
  });

  // GET /api/live-events/search —— 按关键词检索事件（member 及以上）
  router.get("/search", requireRole("member"), async (req: Request, res: Response) => {
    const rawCriteria = req.query.stringCriteria;
    const criteria = typeof rawCriteria === "string" ? rawCriteria.trim() : "";
    if (criteria.length === 0) {
      res.status(400).json({ error: "stringCriteria 不能为空" });
      return;
    }
    if (criteria.length > 200) {
      res.status(400).json({ error: "stringCriteria 超长" });
      return;
    }
    const page = parsePageParam(req.query.page, 1);
    const pageSize = parsePageParam(req.query.pageSize, 20, 100);
    if (page === null || pageSize === null) {
      res.status(400).json({ error: "分页参数非法" });
      return;
    }
    let upstreamPage;
    try {
      upstreamPage = await deps.upstream.search({ stringCriteria: criteria, page, pageSize });
    } catch (err) {
      upstreamUnavailable(res, err);
      return;
    }
    const items = await resolveReadState(normalizeAll(upstreamPage.items));
    res.status(200).json({
      total: upstreamPage.total,
      page: upstreamPage.page,
      pageSize: upstreamPage.pageSize,
      items: await annotateRomaji(items, toRomajiFn),
    });
  });

  // GET /api/live-events/stream —— SSE 实时事件流（member 及以上，按连接透传）
  router.get("/stream", requireRole("member"), async (req: Request, res: Response) => {
    const types = parseTypesParam(req.query.type, PASSTHROUGH_TYPES);
    if (!types.ok) {
      res.status(400).json({ error: "type 参数非法" });
      return;
    }
    // 上游无事件时不主动刷头（实测），服务端主动 flushHeaders 先下 200 + 头
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const controller = new AbortController();
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(": ping\n\n");
    }, heartbeatMs);
    req.on("close", () => {
      clearInterval(heartbeat);
      controller.abort();
    });

    const send = async (envelope: UpstreamEnvelope): Promise<void> => {
      if (controller.signal.aborted || res.writableEnded) return;
      if (envelope.type && PASSTHROUGH_TYPES.includes(envelope.type)) {
        if (controller.signal.aborted || res.writableEnded) return;
        res.write(`event: ${envelope.type}\ndata: ${JSON.stringify(envelope)}\n\n`);
        return;
      }
      const event = toLiveEvent(envelope);
      if (!event) return;
      const [merged] = await resolveReadState([event]);
      if (controller.signal.aborted || res.writableEnded) return;
      const [annotated] = await annotateRomaji(merged ? [merged] : [event], toRomajiFn);
      if (controller.signal.aborted || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(annotated)}\n\n`);
    };

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        controller.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

    try {
      let backoff = backoffInitialMs;
      while (!controller.signal.aborted) {
        // 收到事件即视为连接成功：重连成功后退避重置回起步值（提案 K2「1s 起步」）
        let received = false;
        const trackedSend = async (envelope: UpstreamEnvelope): Promise<void> => {
          received = true;
          await send(envelope);
        };
        try {
          const upstreamTypes = toUpstreamTypes(types.types);
          await deps.upstream.subscribe(upstreamTypes, trackedSend, controller.signal);
        } catch (err) {
          if (controller.signal.aborted) break;
          console.warn("[liveEvents] 上游订阅中断，退避重连:", err instanceof Error ? err.message : err);
        }
        if (controller.signal.aborted) break;
        if (received) backoff = backoffInitialMs;
        await sleep(backoff);
        backoff = Math.min(backoff * 2, backoffMaxMs);
      }
    } finally {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    }
  });

  // POST /api/live-events/read —— 单条标记已读（admin 及以上，幂等）
  router.post("/read", requireRole("admin"), async (req: Request, res: Response) => {
    const eventId = (req.body as { eventId?: unknown } | undefined)?.eventId;
    if (typeof eventId !== "string" || eventId.trim().length === 0) {
      res.status(400).json({ error: "eventId 不能为空" });
      return;
    }
    // 前缀非法（如 watermark:super_chat）会静默摧毁水位线记录，直接拒绝
    if (!typeFromEventId(eventId)) {
      res.status(400).json({ error: "eventId 格式非法" });
      return;
    }
    await markRead(eventId, req.user?.username ?? "unknown");
    res.status(200).json({ ok: true });
  });

  // POST /api/live-events/unread —— 单条取消已读（admin 及以上，幂等；显式 unread 覆盖水位线）
  router.post("/unread", requireRole("admin"), async (req: Request, res: Response) => {
    const eventId = (req.body as { eventId?: unknown } | undefined)?.eventId;
    if (typeof eventId !== "string" || eventId.trim().length === 0) {
      res.status(400).json({ error: "eventId 不能为空" });
      return;
    }
    if (!typeFromEventId(eventId)) {
      res.status(400).json({ error: "eventId 格式非法" });
      return;
    }
    await markUnread(eventId, req.user?.username ?? "unknown");
    res.status(200).json({ ok: true });
  });

  // POST /api/live-events/read-all —— 按类型全部已读（admin 及以上，水位线只前进不后退）
  router.post("/read-all", requireRole("admin"), async (req: Request, res: Response) => {
    const type = (req.body as { type?: unknown } | undefined)?.type;
    if (typeof type !== "string" || !READ_ALL_TYPES.includes(type)) {
      res.status(400).json({ error: "type 参数非法" });
      return;
    }
    let firstPage;
    try {
      firstPage = await deps.upstream.fetchRange(toUpstreamTypes([type]), 1, READ_ALL_PAGE_SIZE);
    } catch (err) {
      upstreamUnavailable(res, err);
      return;
    }
    const events = normalizeAll(firstPage.items);
    if (events.length === 0) {
      res.status(200).json({ ok: true, marked: 0 });
      return;
    }
    const newest = Math.max(...events.map((e) => new Date(e.occurredAt).getTime()));
    const withRead = await resolveReadState(events);
    const marked = withRead.filter((e) => !e.read && new Date(e.occurredAt).getTime() <= newest).length;
    await markAllRead(type, new Date(newest), req.user?.username ?? "unknown");
    res.status(200).json({ ok: true, marked });
  });

  return router;
}
