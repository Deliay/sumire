import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import type { LiveEventsReplayCache } from "../src/infra/liveEventsReplayCache";
import { createMemoryLiveEventsReplayCache } from "../src/infra/liveEventsReplayCache";
import type { UpstreamEnvelope, UpstreamPage } from "../src/liveEvents/upstream";
import danmakuFixture from "./fixtures/live-events/danmaku.json";
import superChatFixture from "./fixtures/live-events/super_chat.json";
import guardBuyFixture from "./fixtures/live-events/guard_buy.json";
import giftFixture from "./fixtures/live-events/gift.json";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------- 会话 / 限速（回放端点公开，注入仅为 createApp 装配） ----------

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

// ---------- 时间轴：BASE_MS 为 13:00:00，偏移秒 ----------

const BASE_MS = Date.UTC(2026, 7, 16, 13, 0, 0);
const iso = (offsetSec: number): string => new Date(BASE_MS + offsetSec * 1000).toISOString();

function withOccurredAt(env: UpstreamEnvelope, offsetSec: number): UpstreamEnvelope {
  return { ...clone(env), occurredAt: iso(offsetSec) };
}

/** 造一条可归一化的 danmaku（eventId 由 id_str 派生，保证唯一）。 */
function danmakuAt(offsetSec: number, seq: number): UpstreamEnvelope {
  const env = clone(danmakuFixture) as UpstreamEnvelope;
  env.occurredAt = iso(offsetSec);
  const info = (env.payload as { info: unknown[] }).info;
  info[15] = {
    extra: JSON.stringify({ id_str: `dm-replay-${seq}`, content: `内容${seq}` }),
    user: {
      uid: 248197,
      base: { name: "紫罗兰的信", face: "https://example.com/face.jpg" },
      medal: { name: "堇色信笺", level: 12, color: "#6680ff" },
    },
  };
  return env;
}

// ---------- 上游 stub（按 page/pageSize 切分倒序列表，模拟 event/range） ----------

/**
 * 上游 stub：识别 `startedAt`/`endedAt` 时间过滤（实测上游支持），过滤后按 occurredAt
 * 倒序分页、`total` 为区间内计数——与真实上游行为一致。传入的 `descending` 为全量倒序数据。
 */
function stubUpstream(descending: UpstreamEnvelope[]) {
  return {
    fetchRange: vi.fn(
      async (
        _types: string[],
        page: number,
        pageSize: number,
        _minPrice?: number,
        startedAt?: string,
        endedAt?: string,
      ): Promise<UpstreamPage> => {
        const startMs = startedAt ? Date.parse(startedAt) : Number.NEGATIVE_INFINITY;
        const endMs = endedAt ? Date.parse(endedAt) : Number.POSITIVE_INFINITY;
        const filtered = descending.filter((item) => {
          const t = Date.parse(item.occurredAt ?? "");
          return Number.isFinite(t) && t >= startMs && t <= endMs;
        });
        const from = (page - 1) * pageSize;
        return {
          total: filtered.length,
          page,
          pageSize,
          items: filtered.slice(from, from + pageSize),
        };
      },
    ),
    subscribe: vi.fn(),
  };
}

function buildApp(upstream: unknown, cache?: LiveEventsReplayCache) {
  return createApp({
    sessionStore: memSessionStore(),
    rateLimiter: unlimited,
    liveEventsUpstream: upstream as never,
    toRomajiFn: async () => null,
    liveEventsReplayCache: cache ?? createMemoryLiveEventsReplayCache(),
  });
}

async function call(
  app: ReturnType<typeof createApp>,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const nodeReq = { method: "GET", url: path, headers: {}, ip: "1.1.1.1" } as unknown as Request;
  return new Promise((resolve) => {
    const res = { statusCode: 0 };
    const nodeRes = {
      status(code: number) {
        res.statusCode = code;
        return nodeRes;
      },
      json(b: unknown) {
        resolve({ status: res.statusCode || 200, body: b });
        return nodeRes;
      },
      setHeader() {
        return nodeRes;
      },
    } as unknown as Response;
    app(nodeReq, nodeRes, () => {});
  });
}

interface ReplayItem {
  eventId: string;
  type: string;
  occurredAt: string;
  sender: Record<string, unknown>;
  content?: string;
  [key: string]: unknown;
}

interface ReplayPage {
  total: number;
  page: number;
  pageSize: number;
  items: ReplayItem[];
}

const START = iso(0);
const END = iso(300);
const RANGE = `start=${encodeURIComponent(START)}&end=${encodeURIComponent(END)}`;

// ---------- 200：升序 / 区间 / 字段裁剪 / 匿名 ----------

describe("GET /api/live-events/replay（公开回放检索）", () => {
  it("匿名 200：升序、全部落在 [start,end]、无 read/nameRomaji/contentRomaji", async () => {
    // 上游倒序：guard(240s) > gift(180s) > sc(120s) > dm(60s)
    const upstream = stubUpstream([
      withOccurredAt(guardBuyFixture, 240),
      withOccurredAt(giftFixture, 180),
      withOccurredAt(superChatFixture, 120),
      withOccurredAt(danmakuFixture, 60),
    ]);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}`);
    expect(r.status).toBe(200);
    const body = r.body as ReplayPage;
    expect(body).toMatchObject({ total: 4, page: 1, pageSize: 100 });
    expect(body.items.map((i) => i.type)).toEqual(["danmaku", "super_chat", "gift", "guard_buy"]);
    // 升序
    const times = body.items.map((i) => new Date(i.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // 全部落在区间
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(new Date(START).getTime());
      expect(t).toBeLessThanOrEqual(new Date(END).getTime());
    }
    // 字段裁剪
    const dm = body.items.find((i) => i.type === "danmaku")!;
    expect(dm).not.toHaveProperty("read");
    expect(dm).not.toHaveProperty("contentRomaji");
    expect(dm.sender).not.toHaveProperty("nameRomaji");
    // sender 契约字段
    expect(typeof dm.sender.uid).toBe("number");
    expect(typeof dm.sender.name).toBe("string");
    expect("face" in dm.sender).toBe(true);
    expect("medal" in dm.sender).toBe(true);
    const sc = body.items.find((i) => i.type === "super_chat")!;
    expect(sc).not.toHaveProperty("read");
    expect(sc).not.toHaveProperty("contentRomaji");
    expect(sc.sender).not.toHaveProperty("nameRomaji");
  });

  it("区间端点包含：恰好等于 start / end 的事件保留", async () => {
    const upstream = stubUpstream([
      withOccurredAt(danmakuFixture, 300),
      withOccurredAt(danmakuFixture, 0),
    ]);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}`);
    const body = r.body as ReplayPage;
    expect(body.total).toBe(2);
  });

  it("区间外事件（早于 start 或晚于 end）被过滤", async () => {
    const upstream = stubUpstream([
      withOccurredAt(danmakuFixture, 400), // > end
      withOccurredAt(danmakuFixture, 60),
      withOccurredAt(danmakuFixture, -10), // < start
    ]);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}`);
    const body = r.body as ReplayPage;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
  });
});

// ---------- type 过滤 / gift 展开 / 缺省四类 ----------

describe("GET /api/live-events/replay type 参数", () => {
  it("缺省四类：上游收到 ['danmaku','super_chat','gift','gift_v2','guard_buy']", async () => {
    const upstream = stubUpstream([]);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}`);
    expect(r.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledWith(
      ["danmaku", "super_chat", "gift", "gift_v2", "guard_buy"],
      1,
      100,
      undefined,
      START,
      END,
    );
  });

  it("type=gift 展开为 ['gift','gift_v2'] 且响应仅含归一化 gift", async () => {
    const upstream = stubUpstream([withOccurredAt(giftFixture, 180)]);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}&type=gift`);
    expect(r.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledWith(["gift", "gift_v2"], 1, 100, undefined, START, END);
    const body = r.body as ReplayPage;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe("gift");
    expect(body.items[0].eventId).toBe("gift:gift:batch:21568305:30607:1755338640");
  });

  it("多 type 重复参数", async () => {
    const upstream = stubUpstream([]);
    const r = await call(
      buildApp(upstream),
      `/api/live-events/replay?${RANGE}&type=danmaku&type=super_chat`,
    );
    expect(r.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledWith(["danmaku", "super_chat"], 1, 100, undefined, START, END);
  });
});

// ---------- 分页 ----------

describe("GET /api/live-events/replay 分页", () => {
  it("page/pageSize 对区间内升序结果切片，上游按同 pageSize 分页", async () => {
    const upstream = stubUpstream([
      withOccurredAt(guardBuyFixture, 240),
      withOccurredAt(giftFixture, 180),
      withOccurredAt(superChatFixture, 120),
      withOccurredAt(danmakuFixture, 60),
    ]);
    const r = await call(
      buildApp(upstream),
      `/api/live-events/replay?${RANGE}&page=2&pageSize=1`,
    );
    expect(r.status).toBe(200);
    const body = r.body as ReplayPage;
    expect(body).toMatchObject({ total: 4, page: 2, pageSize: 1 });
    // 升序 [dm, sc, gift, guard] 的第二页第 1 条 = sc
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe("super_chat");
    // 首次以响应 pageSize 取第 1 页拿 total
    expect(upstream.fetchRange).toHaveBeenCalledWith(expect.any(Array), 1, 1, undefined, START, END);
  });
});

// ---------- 400 全分支 ----------

describe("GET /api/live-events/replay 参数校验 400", () => {
  it.each([
    ["缺 start/end", `/api/live-events/replay`],
    ["缺 end", `/api/live-events/replay?start=${encodeURIComponent(START)}`],
    ["start 格式错误", `/api/live-events/replay?start=abc&end=${encodeURIComponent(END)}`],
    ["end 格式错误", `/api/live-events/replay?start=${encodeURIComponent(START)}&end=nope`],
    ["end 等于 start", `/api/live-events/replay?start=${encodeURIComponent(START)}&end=${encodeURIComponent(START)}`],
    ["end 早于 start", `/api/live-events/replay?start=${encodeURIComponent(END)}&end=${encodeURIComponent(START)}`],
    [
      "区间超过 12h",
      `/api/live-events/replay?start=${encodeURIComponent(START)}&end=${encodeURIComponent(iso(12 * 3600 + 1))}`,
    ],
    ["type 含 online_rank_count", `/api/live-events/replay?${RANGE}&type=online_rank_count`],
    ["type 非法值", `/api/live-events/replay?${RANGE}&type=entry_effect`],
    ["page=0", `/api/live-events/replay?${RANGE}&page=0`],
    ["page=abc", `/api/live-events/replay?${RANGE}&page=abc`],
    ["pageSize=0", `/api/live-events/replay?${RANGE}&pageSize=0`],
    ["pageSize=101", `/api/live-events/replay?${RANGE}&pageSize=101`],
  ])("%s → 400 且 { error } 中文", async (_label, path) => {
    const upstream = stubUpstream([]);
    const r = await call(buildApp(upstream), path);
    expect(r.status).toBe(400);
    const error = (r.body as { error?: unknown }).error;
    expect(typeof error).toBe("string");
    expect((error as string).length).toBeGreaterThan(0);
    expect(upstream.fetchRange).not.toHaveBeenCalled();
  });

  it("end 晚于 start 但恰好 12h 合法（边界内）", async () => {
    const upstream = stubUpstream([]);
    const r = await call(
      buildApp(upstream),
      `/api/live-events/replay?start=${encodeURIComponent(START)}&end=${encodeURIComponent(iso(12 * 3600))}`,
    );
    expect(r.status).toBe(200);
  });
});

// ---------- 502 ----------

describe("GET /api/live-events/replay 上游失败", () => {
  it("上游抛错 → 502 中文错误", async () => {
    const upstream = {
      fetchRange: vi.fn().mockRejectedValue(new Error("upstream status 503")),
      subscribe: vi.fn(),
    };
    const r = await call(buildApp(upstream as never), `/api/live-events/replay?${RANGE}`);
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ error: "上游事件服务不可用" });
  });
});

// ---------- 缓存 ----------

describe("GET /api/live-events/replay 缓存", () => {
  it("同参数二次请求命中缓存，上游 fetchRange 不再调用", async () => {
    const upstream = stubUpstream([withOccurredAt(superChatFixture, 120)]);
    const cache = createMemoryLiveEventsReplayCache();
    const app = buildApp(upstream, cache);
    const path = `/api/live-events/replay?${RANGE}`;
    const first = await call(app, path);
    expect(first.status).toBe(200);
    expect(upstream.fetchRange).toHaveBeenCalledTimes(1);
    const second = await call(app, path);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(upstream.fetchRange).toHaveBeenCalledTimes(1);
  });

  it("不同 page/pageSize 使用不同缓存键（各自回源）", async () => {
    const upstream = stubUpstream([withOccurredAt(superChatFixture, 120)]);
    const app = buildApp(upstream);
    await call(app, `/api/live-events/replay?${RANGE}&page=1&pageSize=50`);
    await call(app, `/api/live-events/replay?${RANGE}&page=2&pageSize=50`);
    expect(upstream.fetchRange).toHaveBeenCalledTimes(2);
  });
});

// ---------- 扫描终止 / 页数上限 ----------

describe("GET /api/live-events/replay 上游时间过滤与分页", () => {
  it("透传 startedAt/endedAt：上游过滤后 total 为区间计数，出口升序", async () => {
    const descending: UpstreamEnvelope[] = [];
    for (let i = 99; i >= 1; i--) descending.push(danmakuAt(i, i));
    descending.push(danmakuAt(-60, 0)); // 区间外（早于 start），上游过滤剔除
    const upstream = stubUpstream(descending);
    const r = await call(buildApp(upstream), `/api/live-events/replay?${RANGE}`);
    expect(r.status).toBe(200);
    const body = r.body as ReplayPage;
    expect(body.total).toBe(99);
    expect(body.items).toHaveLength(99);
    // 时间参数以上游参数名透传
    expect(upstream.fetchRange).toHaveBeenCalledWith(expect.any(Array), 1, 100, undefined, START, END);
    expect(upstream.fetchRange).toHaveBeenCalledTimes(1);
    const times = body.items.map((i) => new Date(i.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(new Date(iso(1)).getTime());
  });

  it("大区间分页：响应页映射到倒序上游页，不扫描全区间", async () => {
    // 5001 条：offset 5000..0，倒序
    const descending: UpstreamEnvelope[] = [];
    for (let i = 5000; i >= 0; i--) descending.push(danmakuAt(i, i));
    const upstream = stubUpstream(descending);
    const r = await call(
      buildApp(upstream),
      `/api/live-events/replay?start=${encodeURIComponent(iso(0))}&end=${encodeURIComponent(iso(5000))}`,
    );
    expect(r.status).toBe(200);
    const body = r.body as ReplayPage;
    expect(body.total).toBe(5001);
    // 升序前 100 条 = offset 0..99
    expect(body.items).toHaveLength(100);
    const times = body.items.map((i) => new Date(i.occurredAt).getTime());
    expect(times[0]).toBe(new Date(iso(0)).getTime());
    expect(times[times.length - 1]).toBe(new Date(iso(99)).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // 升序首页映射到倒序上游 page 50/51（含首请求 page1 共 3 次），非顺序扫描
    const pages = upstream.fetchRange.mock.calls.map((call) => call[1] as number);
    expect(pages.sort((a, b) => a - b)).toEqual([1, 50, 51]);
  });

  it("深页历史区间：过滤后直接取对应倒序页（不依赖距今天数）", async () => {
    // 5001 条：offset 5000..0，倒序
    const descending: UpstreamEnvelope[] = [];
    for (let i = 5000; i >= 0; i--) descending.push(danmakuAt(i, i));
    const upstream = stubUpstream(descending);
    const query = `start=${encodeURIComponent(iso(1000))}&end=${encodeURIComponent(iso(1300))}`;
    const r = await call(buildApp(upstream), `/api/live-events/replay?${query}`);
    expect(r.status).toBe(200);
    const body = r.body as ReplayPage;
    expect(body.total).toBe(301);
    expect(body.items).toHaveLength(100);
    const times = body.items.map((i) => new Date(i.occurredAt).getTime());
    expect(times[0]).toBe(new Date(iso(1000)).getTime());
    expect(times[times.length - 1]).toBe(new Date(iso(1099)).getTime());
    // 升序首页映射到倒序上游 page 3/4
    const pages = upstream.fetchRange.mock.calls.map((call) => call[1] as number);
    expect(pages.sort((a, b) => a - b)).toEqual([1, 3, 4]);
  });

  it("区间早于全部数据（end 早于最旧事件）→ 上游过滤后 total=0，空结果", async () => {
    const descending: UpstreamEnvelope[] = [
      danmakuAt(500, 2),
      danmakuAt(400, 1),
    ];
    const upstream = stubUpstream(descending);
    const r = await call(
      buildApp(upstream),
      `/api/live-events/replay?start=${encodeURIComponent(iso(0))}&end=${encodeURIComponent(iso(100))}`,
    );
    expect(r.status).toBe(200);
    expect((r.body as ReplayPage).total).toBe(0);
    expect((r.body as ReplayPage).items).toHaveLength(0);
  });
});
