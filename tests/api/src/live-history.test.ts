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
const CACHE_KEY = "live-history:latest";

const STUB_PORT = Number(process.env.LIVE_HISTORY_STUB_PORT ?? "9876");

type StubMode = "records" | "invalid" | "non-array" | "hang";

let stubMode: StubMode = "records";
let stubCalls = 0;
let lastUpstreamQuery = "";

/**
 * 生成确定性样本 items（真实上游分页信封 `{ total, page, pageSize, items }` 的 items）：
 * 120 条含额外字段（coverUrl/liveId 等，须被裁剪）与缺字段条目（须被丢弃），startDate 递增。
 */
function sampleItems(): unknown[] {
  const records: unknown[] = [];
  const base = Date.UTC(2026, 0, 1, 12, 0, 0);
  for (let i = 0; i < 120; i++) {
    const start = new Date(base + i * 3600_000).toISOString();
    records.push({
      liveId: `live-${i}`,
      roomId: 1727076670,
      title: `history_${String(i).padStart(3, "0")}`,
      coverUrl: "https://example.com/cover.jpg",
      parentArea: "虚拟主播",
      area: "虚拟日常",
      isFinish: true,
      startDate: start,
      stopDate: new Date(base + i * 3600_000 + 7200_000).toISOString(),
      danmakuCount: 1000,
      watchCount: 2000,
    });
  }
  // 缺字段条目：应由服务端丢弃
  records.push({ title: "", startDate: new Date(base + 999 * 3600_000).toISOString() });
  records.push({ startDate: new Date(base + 1000 * 3600_000).toISOString() });
  return records;
}

function sampleEnvelope(): { total: number; page: number; pageSize: number; items: unknown[] } {
  return { total: 122, page: 1, pageSize: 100, items: sampleItems() };
}

function startStub(): Server {
  const server = createServer((req, res) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (pathname === "/api/b/live/1727076670/history") {
      stubCalls += 1;
      lastUpstreamQuery = (req.url ?? "").includes("?") ? (req.url ?? "").slice((req.url ?? "").indexOf("?")) : "";
      if (stubMode === "hang") {
        // 超过 API 5s 超时后才响应，模拟上游悬挂
        setTimeout(() => {
          try {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify([]));
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
      if (stubMode === "non-array") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ total: 1, page: 1, pageSize: 100, items: "not-an-array" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(sampleEnvelope()));
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
    await redis.del(CACHE_KEY);
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
  await clearCache();
});

describe("GET /api/live-history（公开读代理）", () => {
  it("live-history-200: 返回 { ok, records } 且仅含 title/startDate/stopDate 三字段", async () => {
    stubMode = "records";
    const res = await request("/api/live-history");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; records: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.records)).toBe(true);
    for (const r of body.records) {
      const keys = Object.keys(r as Record<string, unknown>).sort();
      expect(keys).toEqual(["startDate", "stopDate", "title"]);
    }
  });

  it("live-history-limit: 条数 ≤100 且按 startDate 倒序", async () => {
    stubMode = "records";
    const res = await request("/api/live-history");
    const records = (res.body as { records: Array<{ startDate: string; title: string }> }).records;
    expect(records.length).toBeLessThanOrEqual(100);
    const dates = records.map((r) => r.startDate);
    const sortedDesc = [...dates].sort().reverse();
    expect(dates).toEqual(sortedDesc);
  });

  it("live-history-drop: 缺 title/startDate 的条目被丢弃", async () => {
    stubMode = "records";
    const res = await request("/api/live-history");
    const records = (res.body as { records: Array<{ title: string }> }).records;
    expect(records.every((r) => typeof r.title === "string" && r.title.length > 0)).toBe(true);
    // 丢弃后应恰为 100 条（120 条正常 + 2 条缺字段，倒序取前 100）
    expect(records).toHaveLength(100);
  });

  it("live-history-cache: 二次请求命中缓存（stub 调用数不变）", async () => {
    stubMode = "records";
    const first = await request("/api/live-history");
    expect(first.status).toBe(200);
    const callsAfterFirst = stubCalls;
    const second = await request("/api/live-history");
    expect(second.status).toBe(200);
    expect(stubCalls).toBe(callsAfterFirst);
    expect(second.body).toEqual(first.body);
  });

  it("live-history-page-params: 上游取数携带 page=1&pageSize=100", async () => {
    stubMode = "records";
    const res = await request("/api/live-history");
    expect(res.status).toBe(200);
    const qs = new URLSearchParams(lastUpstreamQuery);
    expect(qs.get("page")).toBe("1");
    expect(qs.get("pageSize")).toBe("100");
  });

  it("live-history-timeout: 上游超时降级 ok:false + 空数组（HTTP 200）", async () => {
    stubMode = "hang";
    const res = await request("/api/live-history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, records: [] });
  });

  it("live-history-invalid: 上游非法 JSON 降级 ok:false", async () => {
    stubMode = "invalid";
    const res = await request("/api/live-history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, records: [] });
  });

  it("live-history-non-array: 上游信封 items 非数组降级 ok:false", async () => {
    stubMode = "non-array";
    const res = await request("/api/live-history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, records: [] });
  });
});
