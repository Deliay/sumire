import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app";
import { sessionMiddleware } from "../src/auth/session";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import { createLiveEventsRouter } from "../src/routes/liveEvents";
import type { UpstreamEnvelope, UpstreamPage } from "../src/liveEvents/upstream";
import danmakuFixture from "./fixtures/live-events/danmaku.json";
import superChatFixture from "./fixtures/live-events/super_chat.json";
import guardBuyFixture from "./fixtures/live-events/guard_buy.json";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------- 会话 / 限速 ----------

function memSessionStore(): SessionStore {
  const map = new Map<string, { sid: string; data: unknown }>();
  return {
    async create(data) {
      const sid = `sid-${map.size + 1}-${Math.random().toString(36).slice(2)}`;
      map.set(sid, { sid, data });
      return sid;
    },
    async get(sid) {
      return (map.get(sid)?.data as never) ?? null;
    },
    async touch(sid, data) {
      if (map.has(sid)) map.set(sid, { sid, data });
    },
    async destroy(sid) {
      map.delete(sid);
    },
  };
}

const unlimited: RateLimiter = {
  async isBlocked() {
    return false;
  },
  async recordFailure() {},
  dispose() {},
};

async function sessionCookie(store: SessionStore, role: "superadmin" | "admin" | "member"): Promise<string> {
  const sid = await store.create({
    userId: `u-${role}`,
    username: `${role}1`,
    role,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });
  return `sumire_sid=${sid}`;
}

// ---------- live_event_reads 内存库（忠实模拟单条覆盖 + 水位线只前进语义） ----------

interface ReadRow {
  eventId: string;
  type: string;
  kind: "read" | "unread" | "watermark";
  readBefore?: Date;
  readBy: string;
  readAt: Date;
}

let rows: ReadRow[] = [];

const PREFIX_TYPE: Record<string, string> = { dm: "danmaku", sc: "super_chat", gift: "gift", guard: "guard_buy" };

function upsertSingle(eventId: string, kind: "read" | "unread", readBy: string): void {
  const existing = rows.find((r) => r.eventId === eventId && r.kind !== "watermark");
  if (existing) {
    existing.kind = kind;
    existing.readBy = readBy;
    existing.readAt = new Date();
    delete existing.readBefore;
  } else {
    rows.push({ eventId, type: PREFIX_TYPE[eventId.split(":", 1)[0]] ?? "unknown", kind, readBy, readAt: new Date() });
  }
}

function localRead(e: { eventId: string; type: string; occurredAt: string }): boolean {
  const single = rows.find((r) => r.eventId === e.eventId && r.kind !== "watermark");
  if (single) return single.kind === "read";
  const wm = rows
    .filter((r) => r.kind === "watermark" && r.type === e.type && r.readBefore)
    .sort((a, b) => (b.readBefore?.getTime() ?? 0) - (a.readBefore?.getTime() ?? 0))[0];
  if (wm?.readBefore) return new Date(e.occurredAt).getTime() <= wm.readBefore.getTime();
  return false;
}

const readsModule = await import("../src/db/liveEventReads");
vi.spyOn(readsModule, "markRead").mockImplementation(async (eventId: string, readBy: string) => {
  upsertSingle(eventId, "read", readBy);
});
vi.spyOn(readsModule, "markUnread").mockImplementation(async (eventId: string, readBy: string) => {
  upsertSingle(eventId, "unread", readBy);
});
vi.spyOn(readsModule, "markAllRead").mockImplementation(async (type: string, readBefore: Date, readBy: string) => {
  const id = `watermark:${type}`;
  const existing = rows.find((r) => r.eventId === id);
  if (existing) {
    // $max 语义：只前进不后退
    if (!existing.readBefore || readBefore.getTime() > existing.readBefore.getTime()) existing.readBefore = readBefore;
    existing.readBy = readBy;
  } else {
    rows.push({ eventId: id, type, kind: "watermark", readBefore, readBy, readAt: new Date() });
  }
});
vi.spyOn(readsModule, "resolveReadState").mockImplementation(
  async <T extends { eventId: string; type: string; occurredAt: string }>(events: T[]) =>
    events.map((e) => ({ ...e, read: localRead(e) })),
);

// ---------- 上游 stub ----------

function stubUpstream(page: UpstreamPage) {
  return {
    fetchRange: vi.fn().mockResolvedValue(page),
    subscribe: vi.fn(),
  };
}

function pageOf(items: UpstreamEnvelope[], total = items.length): UpstreamPage {
  return { total, page: 1, pageSize: 50, items };
}

// ---------- 简易请求工具（JSON 端点） ----------

async function call(
  app: ReturnType<typeof createApp>,
  req: { method: string; path: string; body?: unknown; cookie?: string },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};
  if (req.cookie) headers.cookie = req.cookie;
  const nodeReq = { method: req.method, url: req.path, headers, body: req.body, ip: "1.1.1.1" } as unknown as Request;
  return new Promise((resolve) => {
    const res = { headers: {} as Record<string, string>, statusCode: 0 };
    const nodeRes = {
      status(code: number) {
        res.statusCode = code;
        return nodeRes;
      },
      json(b: unknown) {
        resolve({ status: res.statusCode || 200, body: b });
        return nodeRes;
      },
      setHeader(name: string, value: string) {
        res.headers[name] = value;
      },
    } as unknown as Response;
    app(nodeReq, nodeRes, () => {});
  });
}

function buildApp(upstream: ReturnType<typeof stubUpstream>) {
  const store = memSessionStore();
  const app = createApp({ sessionStore: store, rateLimiter: unlimited, liveEventsUpstream: upstream as never });
  return { app, store };
}

beforeEach(() => {
  rows = [];
});

// ---------- 鉴权矩阵 ----------

describe("/api/live-events 鉴权矩阵", () => {
  it.each([
    ["GET", "/api/live-events"],
    ["GET", "/api/live-events/stream"],
    ["POST", "/api/live-events/read"],
    ["POST", "/api/live-events/unread"],
    ["POST", "/api/live-events/read-all"],
  ])("未登录 %s %s → 401", async (method, path) => {
    const { app } = buildApp(stubUpstream(pageOf([])));
    const r = await call(app, { method, path, body: {} });
    expect(r.status).toBe(401);
    expect((r.body as { error: string }).error).toBe("未登录或会话已失效");
  });

  it.each([
    ["POST", "/api/live-events/read", { eventId: "sc:1" }],
    ["POST", "/api/live-events/unread", { eventId: "sc:1" }],
    ["POST", "/api/live-events/read-all", { type: "super_chat" }],
  ])("member %s %s → 403", async (method, path, body) => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method, path, body, cookie });
    expect(r.status).toBe(403);
    expect((r.body as { error: string }).error).toBe("权限不足");
  });

  it("member GET /api/live-events → 200（member 可读）", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([clone(superChatFixture)])));
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method: "GET", path: "/api/live-events", cookie });
    expect(r.status).toBe(200);
  });
});

// ---------- GET /api/live-events 检索 ----------

describe("GET /api/live-events（检索代理 + 归一化 + 已读合并）", () => {
  it("多 type 与分页参数透传上游，响应合并 read", async () => {
    const upstream = stubUpstream(pageOf([clone(superChatFixture), clone(danmakuFixture)], 276));
    const { app, store } = buildApp(upstream);
    const cookie = await sessionCookie(store, "admin");
    const r = await call(app, {
      method: "GET",
      path: "/api/live-events?type=danmaku&type=super_chat&page=2&pageSize=30",
      cookie,
    });
    expect(r.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledWith(["danmaku", "super_chat"], 2, 30);
    const body = r.body as { total: number; page: number; pageSize: number; items: Array<{ eventId: string; read: boolean }> };
    expect(body.total).toBe(276);
    expect(body.items.map((i) => i.eventId)).toEqual(["sc:7788123", "dm:6923001122334455"]);
    expect(body.items.every((i) => i.read === false)).toBe(true);
  });

  it("无法归一化的事件被过滤，不影响其余条目", async () => {
    const upstream = stubUpstream(pageOf([clone(superChatFixture), { type: "entry_effect", payload: {} }]));
    const { app, store } = buildApp(upstream);
    const cookie = await sessionCookie(store, "member");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await call(app, { method: "GET", path: "/api/live-events", cookie });
    expect(r.status).toBe(200);
    const body = r.body as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("缺省参数：全部类型 + page=1&pageSize=50", async () => {
    const upstream = stubUpstream(pageOf([]));
    const { app, store } = buildApp(upstream);
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method: "GET", path: "/api/live-events", cookie });
    expect(r.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledWith(["danmaku", "super_chat", "gift", "guard_buy"], 1, 50);
  });

  it("type 非法 → 400", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method: "GET", path: "/api/live-events?type=entry_effect", cookie });
    expect(r.status).toBe(400);
    expect((r.body as { error: string }).error).toBe("type 参数非法");
  });

  it("pageSize 超上限 → 400", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method: "GET", path: "/api/live-events?pageSize=101", cookie });
    expect(r.status).toBe(400);
  });

  it("上游 5xx → 502 中文错误", async () => {
    const upstream = {
      fetchRange: vi.fn().mockRejectedValue(new Error("upstream status 503")),
      subscribe: vi.fn(),
    };
    const { app, store } = buildApp(upstream as never);
    const cookie = await sessionCookie(store, "member");
    const r = await call(app, { method: "GET", path: "/api/live-events", cookie });
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ error: "上游事件服务不可用" });
  });
});

// ---------- 已读写接口 ----------

describe("POST /api/live-events/read 与 /unread", () => {
  it.each([
    ["/api/live-events/read", {}],
    ["/api/live-events/read", { eventId: "  " }],
    ["/api/live-events/read", { eventId: 42 }],
    ["/api/live-events/unread", {}],
  ])("%s eventId 缺失或为空 → 400", async (path, body) => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "admin");
    const r = await call(app, { method: "POST", path, body, cookie });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: "eventId 不能为空" });
  });

  it("read 幂等：重复调用同一 eventId 仅一条记录", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "admin");
    for (let i = 0; i < 2; i++) {
      const r = await call(app, { method: "POST", path: "/api/live-events/read", body: { eventId: "sc:7788123" }, cookie });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ ok: true });
    }
    expect(rows.filter((r) => r.eventId === "sc:7788123")).toHaveLength(1);
    expect(rows[0].kind).toBe("read");
  });

  it("kind 覆盖：read 后 unread，同一 eventId 最新为 unread", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "admin");
    await call(app, { method: "POST", path: "/api/live-events/read", body: { eventId: "sc:7788123" }, cookie });
    const r = await call(app, { method: "POST", path: "/api/live-events/unread", body: { eventId: "sc:7788123" }, cookie });
    expect(r.status).toBe(200);
    expect(rows.filter((row) => row.eventId === "sc:7788123")).toHaveLength(1);
    expect(rows[0].kind).toBe("unread");
  });

  it("unread 撤销水位线：read-all 置灰后单条取消已读恢复未读", async () => {
    const upstream = stubUpstream(pageOf([clone(superChatFixture)]));
    const { app, store } = buildApp(upstream);
    const admin = await sessionCookie(store, "admin");
    const member = await sessionCookie(store, "member");
    // 全部已读 → 检索已读
    await call(app, { method: "POST", path: "/api/live-events/read-all", body: { type: "super_chat" }, cookie: admin });
    let r = await call(app, { method: "GET", path: "/api/live-events?type=super_chat", cookie: member });
    expect((r.body as { items: Array<{ read: boolean }> }).items[0].read).toBe(true);
    // 单条取消已读 → 恢复未读
    await call(app, { method: "POST", path: "/api/live-events/unread", body: { eventId: "sc:7788123" }, cookie: admin });
    r = await call(app, { method: "GET", path: "/api/live-events?type=super_chat", cookie: member });
    expect((r.body as { items: Array<{ read: boolean }> }).items[0].read).toBe(false);
  });
});

describe("POST /api/live-events/read-all（水位线）", () => {
  it("type 缺失或非法 → 400", async () => {
    const { app, store } = buildApp(stubUpstream(pageOf([])));
    const cookie = await sessionCookie(store, "admin");
    for (const body of [{}, { type: "danmaku" }, { type: 1 }]) {
      const r = await call(app, { method: "POST", path: "/api/live-events/read-all", body, cookie });
      expect(r.status).toBe(400);
    }
  });

  it("写入该类型最新 occurredAt 水位线，marked 为新覆盖条数", async () => {
    const sc2 = clone(superChatFixture);
    (sc2.payload.data as Record<string, unknown>).id = 7788999;
    sc2.occurredAt = "2026-08-16T13:30:00.000Z";
    const upstream = stubUpstream(pageOf([sc2, clone(superChatFixture)]));
    const { app, store } = buildApp(upstream);
    const cookie = await sessionCookie(store, "admin");
    const r = await call(app, { method: "POST", path: "/api/live-events/read-all", body: { type: "super_chat" }, cookie });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, marked: 2 });
    expect(upstream.fetchRange).toHaveBeenCalledWith(["super_chat"], 1, 100);
    const wm = rows.find((row) => row.eventId === "watermark:super_chat");
    expect(wm?.readBefore?.toISOString()).toBe("2026-08-16T13:30:00.000Z");
  });

  it("水位线只前进不后退：再次 read-all 时上游最新事件更旧，水位线不变、marked=0", async () => {
    const upstream = stubUpstream(pageOf([clone(superChatFixture)]));
    const { app, store } = buildApp(upstream);
    const cookie = await sessionCookie(store, "admin");
    await call(app, { method: "POST", path: "/api/live-events/read-all", body: { type: "super_chat" }, cookie });
    // 上游只剩更旧的事件
    const older = clone(superChatFixture);
    older.occurredAt = "2026-08-16T12:00:00.000Z";
    (older.payload.data as Record<string, unknown>).id = 7700000;
    upstream.fetchRange.mockResolvedValue(pageOf([older]));
    const r = await call(app, { method: "POST", path: "/api/live-events/read-all", body: { type: "super_chat" }, cookie });
    expect(r.status).toBe(200);
    expect((r.body as { marked: number }).marked).toBe(0);
    const wm = rows.find((row) => row.eventId === "watermark:super_chat");
    expect(wm?.readBefore?.toISOString()).toBe("2026-08-16T13:22:40.101Z");
  });

  it("上游失败 → 502 中文错误", async () => {
    const upstream = { fetchRange: vi.fn().mockRejectedValue(new Error("timeout")), subscribe: vi.fn() };
    const { app, store } = buildApp(upstream as never);
    const cookie = await sessionCookie(store, "admin");
    const r = await call(app, { method: "POST", path: "/api/live-events/read-all", body: { type: "guard_buy" }, cookie });
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ error: "上游事件服务不可用" });
  });
});

// ---------- SSE（真实 HTTP 服务器） ----------

function sseTestApp(store: SessionStore, upstream: unknown, overrides?: { heartbeatMs?: number; backoffInitialMs?: number; backoffMaxMs?: number }) {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware(store));
  app.use(
    "/api/live-events",
    createLiveEventsRouter({ upstream: upstream as never, heartbeatMs: 30_000, ...overrides }),
  );
  return app;
}

async function withServer(app: express.Application, fn: (port: number) => Promise<void>): Promise<void> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    await fn((server.address() as AddressInfo).port);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
}

/** 订阅挂起直至 signal 中止（模拟上游长连接）。 */
function hangUntilAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("订阅已中止")), { once: true });
  });
}

async function readUntil(body: ReadableStream<Uint8Array>, pred: (text: string) => boolean, timeoutMs = 3000): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  while (!pred(text) && Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const chunk = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("读取超时")), remaining)),
    ]).catch(() => null);
    if (!chunk || chunk.done) break;
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

describe("GET /api/live-events/stream（SSE 透传）", () => {
  it("先下 200 + text/event-stream 头，事件帧格式 data: <LiveEvent JSON>\\n\\n 且合并 read", async () => {
    const store = memSessionStore();
    const cookie = await sessionCookie(store, "member");
    // 预置一条已读记录，验证 SSE 出口也合并 read
    rows.push({ eventId: "sc:7788123", type: "super_chat", kind: "read", readBy: "admin1", readAt: new Date() });
    const upstream = {
      fetchRange: vi.fn(),
      subscribe: vi.fn().mockImplementation(async (_types: string[], onEvent: (e: UpstreamEnvelope) => Promise<void>, signal: AbortSignal) => {
        await onEvent(clone(superChatFixture));
        await onEvent(clone(guardBuyFixture));
        await hangUntilAbort(signal);
      }),
    };
    await withServer(sseTestApp(store, upstream), async (port) => {
      const controller = new AbortController();
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/live-events/stream?type=super_chat&type=guard_buy`, {
          headers: { cookie },
          signal: controller.signal,
        });
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/event-stream");
        const text = await readUntil(res.body!, (t) => t.split("data: ").length - 1 >= 2);
        const frames = text.split("\n\n").filter((f) => f.startsWith("data: "));
        expect(frames).toHaveLength(2);
        const sc = JSON.parse(frames[0].slice("data: ".length)) as { eventId: string; read: boolean };
        const guard = JSON.parse(frames[1].slice("data: ".length)) as { eventId: string; read: boolean };
        expect(sc.eventId).toBe("sc:7788123");
        expect(sc.read).toBe(true);
        expect(guard.eventId).toBe("guard:437917:1755338730");
        expect(guard.read).toBe(false);
      } finally {
        controller.abort();
      }
    });
  });

  it("心跳：间隔内无事件也定期下发 : ping 注释", async () => {
    const store = memSessionStore();
    const cookie = await sessionCookie(store, "member");
    const upstream = {
      fetchRange: vi.fn(),
      subscribe: vi.fn().mockImplementation(async (_t: string[], _cb: unknown, signal: AbortSignal) => hangUntilAbort(signal)),
    };
    await withServer(sseTestApp(store, upstream, { heartbeatMs: 50 }), async (port) => {
      const controller = new AbortController();
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/live-events/stream`, {
          headers: { cookie },
          signal: controller.signal,
        });
        const text = await readUntil(res.body!, (t) => t.includes(": ping"));
        expect(text).toContain(": ping\n\n");
      } finally {
        controller.abort();
      }
    });
  });

  it("上游断流指数退避重连，重连成功后继续下发事件", async () => {
    const store = memSessionStore();
    const cookie = await sessionCookie(store, "member");
    let calls = 0;
    const upstream = {
      fetchRange: vi.fn(),
      subscribe: vi.fn().mockImplementation(async (_t: string[], onEvent: (e: UpstreamEnvelope) => Promise<void>, signal: AbortSignal) => {
        calls += 1;
        if (calls === 1) return; // 第一次立即断流
        await onEvent(clone(danmakuFixture));
        await hangUntilAbort(signal);
      }),
    };
    await withServer(sseTestApp(store, upstream, { backoffInitialMs: 20, backoffMaxMs: 40 }), async (port) => {
      const controller = new AbortController();
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/live-events/stream`, {
          headers: { cookie },
          signal: controller.signal,
        });
        const text = await readUntil(res.body!, (t) => t.includes("dm:6923001122334455"));
        expect(text).toContain("dm:6923001122334455");
        expect(calls).toBeGreaterThanOrEqual(2);
      } finally {
        controller.abort();
      }
    });
  });
});

// ---------- 非 /api 404 回归 ----------

describe("非 /api 路径 404 回归", () => {
  it("GET /live-events（缺 /api 前缀）→ 404", async () => {
    const { app } = buildApp(stubUpstream(pageOf([])));
    const r = await call(app, { method: "GET", path: "/live-events" });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "未找到" });
  });

  it("GET / → 404", async () => {
    const { app } = buildApp(stubUpstream(pageOf([])));
    const r = await call(app, { method: "GET", path: "/" });
    expect(r.status).toBe(404);
  });
});
