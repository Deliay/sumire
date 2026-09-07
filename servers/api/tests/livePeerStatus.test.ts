import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import type { LiveStatusCache } from "../src/infra/liveStatusCache";

const PEER_BASE_URL = "http://vtuber.internal.fffdan.com";
const PEER_ROOMS: Record<string, string> = {
  viridis: "1727071052",
  komichi: "1700301235",
  chu2u: "1727074031",
};

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

describe("GET /api/live/:name/status（同期直播状态，公开读代理）", () => {
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

  it("三个白名单 name 无 Cookie 200 且归一化结构正确", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: true, title: "歌回", startedAt: "2026-09-07T12:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    for (const name of Object.keys(PEER_ROOMS)) {
      const r = await call(buildApp(cache), `/api/live/${name}/status`);
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty("ok", true);
      expect(r.body).toHaveProperty("status");
      const status = (r.body as { status: { live: boolean; title: string | null; startedAt: string | null } }).status;
      expect(typeof status.live).toBe("boolean");
    }
  });

  it("各 name 上游调用路径含对应 roomId", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: false }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    for (const [name, roomId] of Object.entries(PEER_ROOMS)) {
      fetchSpy.mockClear();
      await call(buildApp(cache), `/api/live/${name}/status`);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe(`${PEER_BASE_URL}/api/b/live/${roomId}/state/current`);
    }
  });

  it("未知 name 与大小写变体 404 且 stub 零调用", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: true }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r1 = await call(buildApp(cache), "/api/live/unknown/status");
    expect(r1.status).toBe(404);
    expect(r1.body).toHaveProperty("error", "未知的同期主播");

    const r2 = await call(buildApp(cache), "/api/live/Viridis/status");
    expect(r2.status).toBe(404);
    expect(r2.body).toHaveProperty("error", "未知的同期主播");

    const r3 = await call(buildApp(cache), "/api/live/KOMICHI/status");
    expect(r3.status).toBe(404);
    expect(r3.body).toHaveProperty("error", "未知的同期主播");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("30s 内同 name 二次请求 stub 计数不变、不同 name 独立", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: true }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    await call(buildApp(cache), "/api/live/viridis/status");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await call(buildApp(cache), "/api/live/viridis/status");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await call(buildApp(cache), "/api/live/komichi/status");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("上游 hang → 无缓存 200 { ok: false, status: null }", async () => {
    // 使用一个会在超时前 reject 的 Promise
    fetchSpy.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 100))
    );
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  }, 10000);

  it("上游 invalid JSON → 无缓存 200 { ok: false, status: null }", async () => {
    fetchSpy.mockResolvedValue(okJson("not-json-able-object-shape"));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("上游 non-normalizable → 无缓存 200 { ok: false, status: null }", async () => {
    fetchSpy.mockResolvedValue(okJson({ title: "只有标题" }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, status: null });
  });

  it("有缓存时上游失败返回缓存", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();
    cache.store.set(
      "live-peer-status:viridis",
      JSON.stringify({ ok: true, status: { live: true, title: "cached", startedAt: null } })
    );

    const r = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, status: { live: true, title: "cached", startedAt: null } });
  });

  it("某 name 持续失败时其余 name 正常", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (url.includes("1727071052")) throw new Error("viridis down");
      return okJson({ live: false });
    });
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r1 = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ ok: false, status: null });

    const r2 = await call(buildApp(cache), "/api/live/komichi/status");
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual({ ok: true, status: { live: false, title: null, startedAt: null } });
  });

  it("全程无 5xx", async () => {
    fetchSpy.mockRejectedValue(new Error("anything"));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    for (const name of Object.keys(PEER_ROOMS)) {
      const r = await call(buildApp(cache), `/api/live/${name}/status`);
      expect(r.status).toBeLessThan(500);
    }
  });

  it("缺 title/startedAt 归一化为 null", async () => {
    fetchSpy.mockResolvedValue(okJson({ live: true }));
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();

    const r = await call(buildApp(cache), "/api/live/viridis/status");
    expect(r.status).toBe(200);
    const status = (r.body as { status: { live: boolean; title: string | null; startedAt: string | null } }).status;
    expect(status.title).toBeNull();
    expect(status.startedAt).toBeNull();
  });
});

describe("config.livePeerStatusUpstreamUrl 缺省回退", () => {
  it("未设置 LIVE_PEER_STATUS_UPSTREAM_URL 时回退 PRD 内网地址", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_PEER_STATUS_UPSTREAM_URL", "");
    const { config } = await import("../src/config");
    expect(config.livePeerStatusUpstreamUrl).toBe(PEER_BASE_URL);
    vi.unstubAllEnvs();
  });

  it("已设置时取环境变量值", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_PEER_STATUS_UPSTREAM_URL", "http://localhost:9878/stub");
    const { config } = await import("../src/config");
    expect(config.livePeerStatusUpstreamUrl).toBe("http://localhost:9878/stub");
    vi.unstubAllEnvs();
  });
});
