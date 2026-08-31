import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import {
  normalizeLiveStatus,
  LIVE_STATUS_CACHE_KEY,
} from "../src/routes/liveStatus";
import type { LiveStatusCache } from "../src/infra/liveStatusCache";

const INTERNAL_URL = "http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current";

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

function memCache(): LiveStatusCache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
  };
}

async function call(app: ReturnType<typeof createApp>, path: string): Promise<{ status: number; body: unknown }> {
  const nodeReq = { method: "GET", url: path, headers: {}, ip: "1.1.1.1" } as unknown as Request;
  return new Promise((resolve) => {
    const res = {
      setHeader: vi.fn(),
      headers: {} as Record<string, string>,
      statusCode: 0,
    };
    const nodeRes = {
      ...res,
      status(code: number) {
        res.statusCode = code;
        return nodeRes;
      },
      json(b: unknown) {
        resolve({ status: res.statusCode || 200, body: b });
        return nodeRes;
      },
      setHeader: res.setHeader,
    } as unknown as Response;
    app(nodeReq, nodeRes, () => {});
  });
}

function okJson(value: unknown): { ok: boolean; json: () => Promise<unknown> } {
  return {
    ok: true,
    json: async () => value,
  };
}

describe("normalizeLiveStatus", () => {
  it("顶层 live 布尔 + title/startedAt 透传", () => {
    expect(
      normalizeLiveStatus({ live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" }),
    ).toEqual({ live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" });
  });

  it("缺 title/startedAt 时归一化为 null 不报错", () => {
    expect(normalizeLiveStatus({ live: false })).toEqual({ live: false, title: null, startedAt: null });
  });

  it("兼容嵌套 room_info / data 的 live_status 数字语义", () => {
    expect(normalizeLiveStatus({ room_info: { live_status: 1, title: "早" } })).toEqual({
      live: true,
      title: "早",
      startedAt: null,
    });
    expect(normalizeLiveStatus({ data: { live_status: 0 } })).toEqual({ live: false, title: null, startedAt: null });
  });

  it("兼容实测上游结构（liveStatus 布尔 + createdAt）", () => {
    const upstream = {
      roomId: 1727076670,
      title: "一个普通的早上",
      liveStatus: false,
      liveSessionId: "b75f6f54-5f29-48fa-8eac-f1534d48b48d",
      createdAt: "2026-08-30T03:31:20.967Z",
    };
    expect(normalizeLiveStatus(upstream)).toEqual({
      live: false,
      title: "一个普通的早上",
      startedAt: "2026-08-30T03:31:20.967Z",
    });
  });

  it("无法确定 live 布尔时返回 null", () => {
    expect(normalizeLiveStatus(null)).toBeNull();
    expect(normalizeLiveStatus("x")).toBeNull();
    expect(normalizeLiveStatus({ title: "只有标题" })).toBeNull();
    expect(normalizeLiveStatus({})).toBeNull();
  });
});

describe("GET /api/live/status（公开读代理）", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function buildApp(cache: LiveStatusCache) {
    return createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited, liveStatusCache: cache });
  }

  it("缓存未命中 → 拉上游 → 防御式归一化 → 写缓存 → { ok: true, status }", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();
    const r = await call(buildApp(cache), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, status: { live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" } });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(INTERNAL_URL);
    expect(cache.store.get(LIVE_STATUS_CACHE_KEY)).toContain("歌回");
  });

  it("缓存命中 → 不发上游请求直接返回缓存内容", async () => {
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();
    cache.store.set(LIVE_STATUS_CACHE_KEY, JSON.stringify({ ok: true, status: { live: false, title: null, startedAt: null } }));
    const r = await call(buildApp(cache), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, status: { live: false, title: null, startedAt: null } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("上游非 2xx → 降级体 { ok: false, status: null }（HTTP 200）", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("上游结构非法（无法确定 live 布尔）→ 降级体", async () => {
    fetchSpy.mockResolvedValue(okJson({ title: "只有标题" }));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("上游非法 JSON → 降级体", async () => {
    fetchSpy.mockResolvedValue(okJson("not-json-able-object-shape"));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("上游网络错误且无缓存 → 降级体（HTTP 200）", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("上游失败但有 stale 缓存 → 返回 stale 缓存", async () => {
    fetchSpy.mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchSpy);
    let calls = 0;
    const staleCache: LiveStatusCache = {
      async get() {
        calls += 1;
        return calls >= 2
          ? JSON.stringify({ ok: true, status: { live: true, title: "stale", startedAt: null } })
          : null;
      },
      async set() {},
    };
    const r = await call(buildApp(staleCache), "/api/live/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, status: { live: true, title: "stale", startedAt: null } });
  });
});

describe("config.liveStatusUpstreamUrl 缺省回退", () => {
  it("未设置 LIVE_STATUS_UPSTREAM_URL 时回退 PRD 内网地址", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_STATUS_UPSTREAM_URL", "");
    const { config } = await import("../src/config");
    expect(config.liveStatusUpstreamUrl).toBe(INTERNAL_URL);
    vi.unstubAllEnvs();
  });

  it("已设置时取环境变量值", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_STATUS_UPSTREAM_URL", "http://localhost:9878/stub");
    const { config } = await import("../src/config");
    expect(config.liveStatusUpstreamUrl).toBe("http://localhost:9878/stub");
    vi.unstubAllEnvs();
  });
});