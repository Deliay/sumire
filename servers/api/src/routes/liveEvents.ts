import { Router, type Request, type Response } from "express";
import { requireRole } from "../rbac/requireRole";
import { toLiveEvent, type LiveEvent, type LiveEventType } from "../liveEvents/normalize";
import { toRomaji } from "../liveEvents/romaji";
import type { LiveEventsUpstream, UpstreamEnvelope } from "../liveEvents/upstream";
import { markRead, markUnread, markAllRead, resolveReadState, typeFromEventId } from "../db/liveEventReads";

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = ["danmaku", "super_chat", "gift", "guard_buy"];
/** 「全部已读」仅支持需要已读管理的类型（契约口径）。 */
const READ_ALL_TYPES: readonly string[] = ["super_chat", "guard_buy"];

const HEARTBEAT_MS = 30_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const READ_ALL_PAGE_SIZE = 100;

export interface LiveEventsRouterDeps {
  upstream: LiveEventsUpstream;
  /** 文本 → 罗马音标注（缺省用 kuroshiro 全文转换；单测可注入恒 null 或以 text 取巧）。 */
  toRomajiFn?: (text: string) => Promise<string | null>;
  /** SSE 心跳间隔（缺省 30s，单测可调小）。 */
  heartbeatMs?: number;
  /** 上游断流重连退避：起步 1s，倍增至 30s 上限（单测可调小）。 */
  backoffInitialMs?: number;
  backoffMaxMs?: number;
}

/** type 查询参数：可重复，缺省为全部四类；含非法值则整体 400。 */
function parseTypesParam(value: unknown): { ok: boolean; types: string[] } {
  if (value === undefined) return { ok: true, types: [...LIVE_EVENT_TYPES] };
  const list = Array.isArray(value) ? value : [value];
  const types: string[] = [];
  for (const v of list) {
    if (typeof v !== "string" || !(LIVE_EVENT_TYPES as readonly string[]).includes(v)) {
      return { ok: false, types: [] };
    }
    types.push(v);
  }
  return { ok: true, types };
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

  // GET /api/live-events —— 历史事件检索（member 及以上）
  router.get("/", requireRole("member"), async (req: Request, res: Response) => {
    const types = parseTypesParam(req.query.type);
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
    try {
      upstreamPage = minPrice !== undefined
        ? await deps.upstream.fetchRange(types.types, page, pageSize, minPrice)
        : await deps.upstream.fetchRange(types.types, page, pageSize);
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
    const types = parseTypesParam(req.query.type);
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
          await deps.upstream.subscribe(types.types, trackedSend, controller.signal);
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
      firstPage = await deps.upstream.fetchRange([type], 1, READ_ALL_PAGE_SIZE);
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
