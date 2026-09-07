import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { Redis } from "ioredis";
import { request, waitForReady } from "./client.js";

const API_BASE_URL = process.env.API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("缺少环境变量 API_BASE_URL（通过 aspire describe api 获取端点注入）");
}

// 缓存清理用（经 aspire describe redis 取端点注入）；未提供则跳过清理，缓存相关用例可能受串扰
const REDIS_URL = process.env.REDIS_URL ?? "";
const CACHE_KEY = "live-status:latest";
const PEER_CACHE_KEYS = ["live-peer-status:viridis", "live-peer-status:komichi", "live-peer-status:chu2u"];

const STUB_PORT = Number(process.env.LIVE_STATUS_STUB_PORT ?? "9878");

type StubMode = "live" | "offline" | "invalid" | "non-normalizable" | "hang";

let stubMode: StubMode = "live";
let stubCalls = 0;
const stubCallsByRoom: Record<string, number> = {};

function liveBody(): unknown {
  return { live: true, title: "【歌回】晚好", startedAt: "2026-08-31T12:00:00.000Z" };
}

function offlineBody(): unknown {
  return { live: false, title: null, startedAt: null };
}

function startStub(): Server {
  const server = createServer((req, res) => {
    const pathname = (req.url ?? "").split("?")[0];
    
    // 本人房间
    if (pathname === "/api/b/live/1727076670/state/current") {
      stubCalls += 1;
      if (stubMode === "hang") {
        setTimeout(() => {
          try {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(liveBody()));
          } catch {
            /* 连接已被 API 中止 */
          }
        }, 6000);
        return;
      }
      if (stubMode === "invalid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("this-is-not-json");
        return;
      }
      if (stubMode === "non-normalizable") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ title: "只有标题，无法确定 live 布尔" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stubMode === "offline" ? offlineBody() : liveBody()));
      return;
    }
    
    // 同期房间
    const peerMatch = pathname.match(/^\/api\/b\/live\/(\d+)\/state\/current$/);
    if (peerMatch) {
      const roomId = peerMatch[1];
      stubCallsByRoom[roomId] = (stubCallsByRoom[roomId] ?? 0) + 1;
      if (stubMode === "hang") {
        setTimeout(() => {
          try {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(liveBody()));
          } catch {
            /* 连接已被 API 中止 */
          }
        }, 6000);
        return;
      }
      if (stubMode === "invalid") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("this-is-not-json");
        return;
      }
      if (stubMode === "non-normalizable") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ title: "只有标题，无法确定 live 布尔" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stubMode === "offline" ? offlineBody() : liveBody()));
      return;
    }
    
    res.writeHead(404);
    res.end();
  });
  return server;
}

/** 启动 stub 并等待端口就绪（避免 beforeAll 后首请求时尚未绑定）。 */
async function listenStub(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(STUB_PORT, "127.0.0.1");
  });
}

async function clearCache(): Promise<void> {
  if (!REDIS_URL) return;
  // Aspire 注入的 Redis 为 TLS（rediss://）自签证书，清理连接禁用证书校验
  const opts = REDIS_URL.startsWith("rediss://")
    ? { tls: { rejectUnauthorized: false } }
    : {};
  const redis = new Redis(REDIS_URL, { ...opts, lazyConnect: true });
  try {
    await redis.del(CACHE_KEY, ...PEER_CACHE_KEYS);
  } catch (e) {
    console.warn("缓存清理失败", e);
  } finally {
    redis.disconnect();
  }
}

let server: Server;

beforeAll(async () => {
  server = startStub();
  await listenStub(server);
  await waitForReady();
});

afterAll(() => {
  if (server) server.close();
});

beforeEach(async () => {
  stubCalls = 0;
  Object.keys(stubCallsByRoom).forEach((k) => delete stubCallsByRoom[k]);
  await clearCache();
});

describe("GET /api/live/status（公开读代理）", () => {
  it("live-status-200: 未登录可访问，正常体含 ok 与 status.live 布尔", async () => {
    stubMode = "live";
    const res = await request("/api/live/status");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; status: { live: boolean; title: string | null; startedAt: string | null } };
    expect(body.ok).toBe(true);
    expect(typeof body.status.live).toBe("boolean");
    expect(body.status.live).toBe(true);
    expect(typeof body.status.title).toBe("string");
    expect(typeof body.status.startedAt).toBe("string");
  });

  it("live-status-offline: 上游 live=false 归一化为 { ok:true, status.live:false }", async () => {
    stubMode = "offline";
    const res = await request("/api/live/status");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; status: { live: boolean } };
    expect(body.ok).toBe(true);
    expect(body.status.live).toBe(false);
  });

  it("live-status-cache: 二次请求命中缓存（stub 调用数不变）", async () => {
    stubMode = "live";
    const first = await request("/api/live/status");
    expect(first.status).toBe(200);
    const callsAfterFirst = stubCalls;
    const second = await request("/api/live/status");
    expect(second.status).toBe(200);
    expect(stubCalls).toBe(callsAfterFirst);
    expect(second.body).toEqual(first.body);
  });

  it("live-status-timeout: 上游超时降级 ok:false + status:null（HTTP 200）", async () => {
    stubMode = "hang";
    const res = await request("/api/live/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });

  it("live-status-invalid: 上游非法 JSON 降级 ok:false", async () => {
    stubMode = "invalid";
    const res = await request("/api/live/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });

  it("live-status-non-normalizable: 上游结构无法归一化降级 ok:false", async () => {
    stubMode = "non-normalizable";
    const res = await request("/api/live/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });
});

describe("GET /api/live/:name/status（同期直播状态，公开读代理）", () => {
  const PEER_ROOMS: Record<string, string> = {
    viridis: "1727071052",
    komichi: "1700301235",
    chu2u: "1727074031",
  };

  it("三个白名单 name 无 Cookie 200 且归一化结构正确", async () => {
    stubMode = "live";
    for (const name of Object.keys(PEER_ROOMS)) {
      const res = await request(`/api/live/${name}/status`);
      expect(res.status).toBe(200);
      const body = res.body as { ok: boolean; status: { live: boolean; title: string | null; startedAt: string | null } };
      expect(body.ok).toBe(true);
      expect(typeof body.status.live).toBe("boolean");
    }
  });

  it("各 name 上游调用路径含对应 roomId", async () => {
    stubMode = "live";
    for (const [name, roomId] of Object.entries(PEER_ROOMS)) {
      stubCallsByRoom[roomId] = 0;
      await request(`/api/live/${name}/status`);
      expect(stubCallsByRoom[roomId]).toBe(1);
    }
  });

  it("未知 name 与大小写变体 404 且 stub 零调用", async () => {
    stubMode = "live";
    const callsBefore = { ...stubCallsByRoom };
    
    const r1 = await request("/api/live/unknown/status");
    expect(r1.status).toBe(404);
    expect(r1.body).toHaveProperty("error", "未知的同期主播");
    
    const r2 = await request("/api/live/Viridis/status");
    expect(r2.status).toBe(404);
    expect(r2.body).toHaveProperty("error", "未知的同期主播");
    
    const r3 = await request("/api/live/KOMICHI/status");
    expect(r3.status).toBe(404);
    expect(r3.body).toHaveProperty("error", "未知的同期主播");
    
    // stub 计数不变
    for (const [roomId, count] of Object.entries(callsBefore)) {
      expect(stubCallsByRoom[roomId] ?? 0).toBe(count);
    }
  });

  it("30s 内同 name 二次请求 stub 计数不变、不同 name 独立", async () => {
    stubMode = "live";
    await request("/api/live/viridis/status");
    const callsAfterFirst = stubCallsByRoom["1727071052"] ?? 0;
    
    await request("/api/live/viridis/status");
    expect(stubCallsByRoom["1727071052"]).toBe(callsAfterFirst);
    
    await request("/api/live/komichi/status");
    expect(stubCallsByRoom["1700301235"]).toBe(1);
  });

  it("上游 hang → 无缓存 200 { ok: false, status: null }", async () => {
    stubMode = "hang";
    const res = await request("/api/live/viridis/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });

  it("上游 invalid JSON → 无缓存 200 { ok: false, status: null }", async () => {
    stubMode = "invalid";
    const res = await request("/api/live/viridis/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });

  it("上游 non-normalizable → 无缓存 200 { ok: false, status: null }", async () => {
    stubMode = "non-normalizable";
    const res = await request("/api/live/viridis/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, status: null });
  });

  it("有缓存时上游失败返回缓存", async () => {
    stubMode = "live";
    await request("/api/live/viridis/status");
    
    stubMode = "hang";
    const res = await request("/api/live/viridis/status");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; status: { live: boolean } };
    expect(body.ok).toBe(true);
    expect(body.status.live).toBe(true);
  });

  it("某 name 持续失败时其余 name 正常", async () => {
    stubMode = "hang";
    const r1 = await request("/api/live/viridis/status");
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ ok: false, status: null });
    
    stubMode = "live";
    const r2 = await request("/api/live/komichi/status");
    expect(r2.status).toBe(200);
    const body2 = r2.body as { ok: boolean; status: { live: boolean } };
    expect(body2.ok).toBe(true);
    expect(body2.status.live).toBe(true);
  });

  it("全程无 5xx", async () => {
    stubMode = "hang";
    for (const name of Object.keys(PEER_ROOMS)) {
      const res = await request(`/api/live/${name}/status`);
      expect(res.status).toBeLessThan(500);
    }
  });

  it("live 模式 title/startedAt 正常透传", async () => {
    stubMode = "live";
    const res = await request("/api/live/viridis/status");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; status: { live: boolean; title: string | null; startedAt: string | null } };
    expect(body.ok).toBe(true);
    expect(typeof body.status.title).toBe("string");
    expect(typeof body.status.startedAt).toBe("string");
  });
});