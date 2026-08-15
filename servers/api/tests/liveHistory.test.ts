import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import { normalizeRecords, isLiveRecord, LIVE_HISTORY_CACHE_KEY } from "../src/routes/liveHistory";
import type { LiveHistoryCache } from "../src/infra/liveHistoryCache";

const INTERNAL_URL = "http://vtuber.internal.fffdan.com/api/b/live/1727076670/history";

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

function memCache(): LiveHistoryCache & { store: Map<string, string> } {
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

describe("normalizeRecords / isLiveRecord", () => {
  it("仅透传三字段，缺 title/startDate 丢弃，按 startDate 倒序", () => {
    const input = [
      { title: "a", startDate: "2026-08-10T20:00:00+08:00", stopDate: "x", extra: "drop" },
      { title: "b", startDate: "2026-08-12T20:00:00+08:00" },
      { startDate: "2026-08-13T20:00:00+08:00" },
      { title: "c" },
      { title: "d", startDate: "2026-08-11T20:00:00+08:00", stopDate: "y" },
      "not-an-object",
    ];
    const out = normalizeRecords(input);
    expect(out).toEqual([
      { title: "b", startDate: "2026-08-12T20:00:00+08:00" },
      { title: "d", startDate: "2026-08-11T20:00:00+08:00", stopDate: "y" },
      { title: "a", startDate: "2026-08-10T20:00:00+08:00", stopDate: "x" },
    ]);
  });

  it("非数组返回空数组", () => {
    expect(normalizeRecords(null)).toEqual([]);
    expect(normalizeRecords({})).toEqual([]);
    expect(normalizeRecords("x")).toEqual([]);
  });

  it("超过 100 条仅取前 100 条（倒序）", () => {
    const base = Date.UTC(2026, 7, 1, 12, 0, 0);
    const input = Array.from({ length: 150 }, (_, i) => ({
      title: `t${i}`,
      startDate: new Date(base + i * 86_400_000).toISOString(),
    }));
    const out = normalizeRecords(input);
    expect(out).toHaveLength(100);
    expect(out[0].title).toBe("t149");
    expect(out[99].title).toBe("t50");
  });

  it("isLiveRecord 校验", () => {
    expect(isLiveRecord({ title: "x", startDate: "y" })).toBe(true);
    expect(isLiveRecord({ title: "", startDate: "y" })).toBe(false);
    expect(isLiveRecord({ title: "x", startDate: "" })).toBe(false);
    expect(isLiveRecord(null)).toBe(false);
  });
});

describe("GET /api/live-history（公开读代理）", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function buildApp(cache: LiveHistoryCache) {
    return createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited, liveHistoryCache: cache });
  }

  it("缓存未命中 → 拉上游 → 裁剪倒序 → 写缓存 → { ok: true, records }", async () => {
    fetchSpy.mockResolvedValue(
      okJson([
        { title: "早", startDate: "2026-08-10T08:00:00+08:00" },
        { title: "晚", startDate: "2026-08-10T20:00:00+08:00" },
      ]),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();
    const r = await call(buildApp(cache), "/api/live-history");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      ok: true,
      records: [
        { title: "晚", startDate: "2026-08-10T20:00:00+08:00" },
        { title: "早", startDate: "2026-08-10T08:00:00+08:00" },
      ],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(INTERNAL_URL);
    expect(cache.store.get(LIVE_HISTORY_CACHE_KEY)).toContain("晚");
  });

  it("缓存命中 → 不发上游请求直接返回缓存内容", async () => {
    vi.stubGlobal("fetch", fetchSpy);
    const cache = memCache();
    cache.store.set(
      LIVE_HISTORY_CACHE_KEY,
      JSON.stringify({ ok: true, records: [{ title: "缓存", startDate: "2026-08-01T20:00:00+08:00" }] }),
    );
    const r = await call(buildApp(cache), "/api/live-history");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, records: [{ title: "缓存", startDate: "2026-08-01T20:00:00+08:00" }] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("上游非法 JSON（非数组）→ 降级体 { ok: false, records: [] }", async () => {
    fetchSpy.mockResolvedValue(okJson({ records: "not-array" }));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live-history");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, records: [] });
  });

  it("上游网络错误且无缓存 → 降级体（HTTP 200）", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchSpy);
    const r = await call(buildApp(memCache()), "/api/live-history");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, records: [] });
  });

  it("上游失败但有 stale 缓存 → 返回 stale 缓存", async () => {
    fetchSpy.mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchSpy);
    // 首次 get（顶部缓存探测）返回 null，触发上游；失败后第二次 get 返回 stale
    let calls = 0;
    const staleCache: LiveHistoryCache = {
      async get() {
        calls += 1;
        return calls >= 2
          ? JSON.stringify({ ok: true, records: [{ title: "stale", startDate: "2026-08-01T20:00:00+08:00" }] })
          : null;
      },
      async set() {},
    };
    const r = await call(buildApp(staleCache), "/api/live-history");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, records: [{ title: "stale", startDate: "2026-08-01T20:00:00+08:00" }] });
  });
});

describe("config.liveHistoryUpstreamUrl 缺省回退", () => {
  it("未设置 LIVE_HISTORY_UPSTREAM_URL 时回退 PRD 内网地址", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_HISTORY_UPSTREAM_URL", "");
    const { config } = await import("../src/config");
    expect(config.liveHistoryUpstreamUrl).toBe(INTERNAL_URL);
    vi.unstubAllEnvs();
  });

  it("已设置时取环境变量值", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_HISTORY_UPSTREAM_URL", "http://localhost:9999/stub");
    const { config } = await import("../src/config");
    expect(config.liveHistoryUpstreamUrl).toBe("http://localhost:9999/stub");
    vi.unstubAllEnvs();
  });
});
