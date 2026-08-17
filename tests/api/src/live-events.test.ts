import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import {
  CookieJar,
  createRoleAccount,
  request,
  strongPassword,
  waitForReady,
} from "./client.js";

const API_BASE_URL = process.env.API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("缺少环境变量 API_BASE_URL（通过 aspire describe api 获取端点注入）");
}

// 测试进程内 stub 上游固定端口（与 live-history 的 9876 隔离）；
// 须与 Aspire 启动时注入的 LIVE_EVENTS_UPSTREAM_URL 端口一致
const STUB_PORT = Number(process.env.LIVE_EVENTS_STUB_PORT ?? "9877");

// 上游事件端点前缀（range 分页检索 + subscribe SSE，路径由 api 侧拼接在 base URL 之后）
const EVENT_PREFIX = "/api/b/live/1727076670";

const rand = () => Math.random().toString(36).slice(2, 10);

/**
 * 上游统一信封形态（模拟真实内网事件服务）：
 * `{ roomId, type, occurredAt, liveSessionId, payload }`，payload 为 B 站原始 cmd 对象。
 */
interface StubEnvelope {
  roomId: number;
  type: string;
  occurredAt: string;
  liveSessionId: string;
  payload: unknown;
}

const BASE_TS = Date.UTC(2026, 7, 1, 12, 0, 0);
const at = (min: number) => new Date(BASE_TS + min * 60_000).toISOString();

function danmaku(i: number, min: number): StubEnvelope {
  const info: unknown[] = new Array(16).fill(null);
  info[0] = {};
  info[1] = `弹幕内容${i}`;
  info[2] = [10_000 + i, `观众${i}`];
  // 经典数组牌子：[0]=等级，[1]=牌名，[2]=主播名，[6]=颜色整数
  info[3] = [5, "堇色粉", "枝堇Sumire", 0, 0, 0, 11_839_167];
  // dm_v2 结构化字段：eventId（extra.id_str）与头像来源
  info[15] = {
    extra: JSON.stringify({ id_str: `dm-stub-${String(i).padStart(3, "0")}`, content: `弹幕内容${i}` }),
    user: {
      uid: 10_000 + i,
      base: { name: `观众${i}`, face: "https://example.com/face.jpg" },
      medal: { name: "堇色粉", level: 5, color: "#b4a6bf" },
    },
  };
  return {
    roomId: 1727076670,
    type: "danmaku",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: { info },
  };
}

function superChat(i: number, min: number): StubEnvelope {
  return {
    roomId: 1727076670,
    type: "super_chat",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: {
      data: {
        id: 900_000 + i,
        uid: 20_000 + i,
        price: 30,
        message: `SC留言${i}`,
        background_color_start: "#EDF5FF",
        background_color_end: "#A7C4FF",
        message_font_color: "#333333",
        uinfo: { base: { name: `SC用户${i}`, face: "https://example.com/sc-face.jpg" } },
        medal_info: { medal_name: "堇色粉", medal_level: 10, medal_color: "#b4a6bf" },
      },
    },
  };
}

function gift(i: number, min: number): StubEnvelope {
  return {
    roomId: 1727076670,
    type: "gift",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: {
      data: {
        uid: 30_000 + i,
        uname: `礼物用户${i}`,
        face: "https://example.com/gift-face.jpg",
        giftName: "小花花",
        num: 1,
        coin_type: "gold",
        combo_total_coin: 1000,
        batch_combo_id: `batch-stub-${i}`,
        combo_id: `combo-stub-${i}`,
        combo_send: { combo_num: 2 },
        medal_info: { medal_name: "堇色粉", medal_level: 8, medal_color: "#b4a6bf" },
      },
    },
  };
}

function guardBuy(i: number, min: number): StubEnvelope {
  return {
    roomId: 1727076670,
    type: "guard_buy",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: {
      data: {
        uid: 40_000 + i,
        username: `船员${i}`,
        guard_level: 3,
        gift_name: "舰长",
        num: 1,
        price: 198_000,
        start_time: 1_786_000_000 + i,
      },
    },
  };
}

/** 确定性数据集：弹幕×12 / SC×8 / 礼物×6 / 上船×6，共 32 条，occurredAt 递增。 */
function dataset(): StubEnvelope[] {
  const events: StubEnvelope[] = [];
  for (let i = 0; i < 12; i++) events.push(danmaku(i, i));
  for (let i = 0; i < 8; i++) events.push(superChat(i, 12 + i));
  for (let i = 0; i < 6; i++) events.push(gift(i, 20 + i));
  for (let i = 0; i < 6; i++) events.push(guardBuy(i, 26 + i));
  return events;
}

const ALL_EVENTS = dataset();

/** 模拟上游行为：按 type 过滤（缺省全部），按 occurredAt 倒序。 */
function filterByTypes(types: string[]): StubEnvelope[] {
  const filtered = types.length > 0 ? ALL_EVENTS.filter((e) => types.includes(e.type)) : [...ALL_EVENTS];
  return filtered.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

type RangeMode = "ok" | "error" | "empty";
let rangeMode: RangeMode = "ok";
let lastRangeSearch = "";
let lastSubscribeTypes: string[] = [];

function startStub(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === `${EVENT_PREFIX}/event/range`) {
      lastRangeSearch = url.search;
      if (rangeMode === "error") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "stub upstream broken" }));
        return;
      }
      if (rangeMode === "empty") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ total: 0, page: 1, pageSize: 50, items: [] }));
        return;
      }
      const types = url.searchParams.getAll("type");
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
      const filtered = filterByTypes(types);
      const items = filtered.slice((page - 1) * pageSize, page * pageSize);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: filtered.length, page, pageSize, items }));
      return;
    }
    if (url.pathname === `${EVENT_PREFIX}/event/subscribe`) {
      lastSubscribeTypes = url.searchParams.getAll("type");
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      // 连接建立后立即下发两条事件帧，随后保持连接（模拟真实上游长连接）
      for (const e of filterByTypes(lastSubscribeTypes).slice(0, 2)) {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      }
      req.on("close", () => res.end());
      return;
    }
    res.writeHead(404);
    res.end();
  });
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

interface LiveEventShape {
  eventId: string;
  type: string;
  occurredAt: string;
  read: boolean;
  sender: { uid: number; name: string; face: string | null; medal: unknown };
  [key: string]: unknown;
}

interface PageShape {
  total: number;
  page: number;
  pageSize: number;
  items: LiveEventShape[];
}

/** 检索并断言 200，返回分页信封。 */
async function fetchEvents(query: string, jar: CookieJar): Promise<PageShape> {
  const res = await request(`/api/live-events${query}`, { jar });
  expect(res.status).toBe(200);
  return res.body as PageShape;
}

function expectLiveEventShape(ev: LiveEventShape): void {
  expect(typeof ev.eventId).toBe("string");
  expect(ev.eventId.length).toBeGreaterThan(0);
  expect(["danmaku", "super_chat", "gift", "guard_buy"]).toContain(ev.type);
  expect(typeof ev.occurredAt).toBe("string");
  expect(typeof ev.read).toBe("boolean");
  expect(typeof ev.sender).toBe("object");
  expect(typeof ev.sender.uid).toBe("number");
  expect(typeof ev.sender.name).toBe("string");
  expect("face" in ev.sender).toBe(true);
  expect("medal" in ev.sender).toBe(true);
}

/** 解析 SSE 文本中的 data 帧负载（跳过注释/心跳行）。 */
function parseSseFrames(text: string): LiveEventShape[] {
  return text
    .split("\n\n")
    .map((f) => f.trim())
    .filter((f) => f.startsWith("data:"))
    .map((f) => JSON.parse(f.slice(5).trim()) as LiveEventShape);
}

/** 读取 SSE 流直到 until 满足或超时；返回累计文本并关闭读取端。 */
async function collectSse(res: Response, until: (text: string) => boolean, timeoutMs: number): Promise<string> {
  if (!res.body) throw new Error("SSE 响应无 body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  try {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`等待 SSE 数据超时（${timeoutMs}ms），已收到: ${JSON.stringify(text)}`);
      }
      const chunk = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("read 超时")), remaining)),
      ]);
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
      if (until(text)) return text;
    }
    return text;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function openStream(query: string, jar: CookieJar): Promise<Response> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  const cookie = jar.cookieHeader;
  if (cookie) headers.Cookie = cookie;
  return fetch(`${API_BASE_URL}/api/live-events/stream${query}`, { headers });
}

let stub: Server;
let memberJar: CookieJar;
let adminJar: CookieJar;

beforeAll(async () => {
  stub = startStub();
  await listenStub(stub);
  await waitForReady();
  memberJar = await createRoleAccount("member", `mb_${rand()}`, strongPassword);
  adminJar = await createRoleAccount("admin", `ad_${rand()}`, strongPassword);
});

afterAll(() => {
  if (stub) stub.close();
});

describe("live-events 鉴权矩阵", () => {
  it("live-events-401: 五端点未认证均 401 且返回 { error }", async () => {
    const gets = ["/api/live-events", "/api/live-events/stream"];
    for (const path of gets) {
      const res = await request(path);
      expect(res.status).toBe(401);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
    for (const path of ["/api/live-events/read", "/api/live-events/unread", "/api/live-events/read-all"]) {
      const res = await request(path, { method: "POST", body: {} });
      expect(res.status).toBe(401);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });

  it("live-events-member: member 读端点可用、三写接口均 403", async () => {
    const list = await request("/api/live-events", { jar: memberJar });
    expect(list.status).toBe(200);
    const writes: Array<[string, unknown]> = [
      ["/api/live-events/read", { eventId: "sc:1" }],
      ["/api/live-events/unread", { eventId: "sc:1" }],
      ["/api/live-events/read-all", { type: "super_chat" }],
    ];
    for (const [path, body] of writes) {
      const res = await request(path, { method: "POST", body, jar: memberJar });
      expect(res.status).toBe(403);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });
});

describe("GET /api/live-events（检索代理）", () => {
  it("live-events-shape: 分页信封齐全，items 归一化为 LiveEvent 且含 read 字段", async () => {
    const body = await fetchEvents("", memberJar);
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    for (const ev of body.items) expectLiveEventShape(ev);
    // 缺省为全部四类
    const types = new Set(body.items.map((e) => e.type));
    expect(types).toEqual(new Set(["danmaku", "super_chat", "gift", "guard_buy"]));
  });

  it("live-events-types: 多 type 组合透传上游（重复 type 参数），响应仅含所选类型", async () => {
    const body = await fetchEvents("?type=danmaku&type=super_chat", memberJar);
    expect(body.items.length).toBeGreaterThan(0);
    for (const ev of body.items) {
      expect(["danmaku", "super_chat"]).toContain(ev.type);
    }
    const qs = new URLSearchParams(lastRangeSearch);
    expect(qs.getAll("type")).toEqual(["danmaku", "super_chat"]);
  });

  it("live-events-pagination: page/pageSize 透传上游，响应信封一致", async () => {
    const body = await fetchEvents("?page=2&pageSize=10", memberJar);
    const qs = new URLSearchParams(lastRangeSearch);
    expect(qs.get("page")).toBe("2");
    expect(qs.get("pageSize")).toBe("10");
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
    expect(body.total).toBe(32);
    expect(body.items).toHaveLength(10);
  });

  it("live-events-502: 上游 5xx → 502 中文错误", async () => {
    rangeMode = "error";
    try {
      const res = await request("/api/live-events", { jar: memberJar });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "上游事件服务不可用" });
    } finally {
      rangeMode = "ok";
    }
  });

  it("live-events-400-type: type 含非法值 → 400 且返回 { error }", async () => {
    const res = await request("/api/live-events?type=entry_effect", { jar: memberJar });
    expect(res.status).toBe(400);
    expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
  });

  it("live-events-400-pagination: 分页参数非法 → 400 且返回 { error }", async () => {
    for (const query of ["?page=0", "?pageSize=101", "?page=abc"]) {
      const res = await request(`/api/live-events${query}`, { jar: memberJar });
      expect(res.status).toBe(400);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });

  it("live-events-minprice: minPrice=5 透传上游（stub 收到 minPrice=5）", async () => {
    const body = await fetchEvents("?type=gift&minPrice=5", memberJar);
    expect(body.items.length).toBeGreaterThan(0);
    for (const ev of body.items) {
      expect(ev.type).toBe("gift");
    }
    const qs = new URLSearchParams(lastRangeSearch);
    expect(qs.get("minPrice")).toBe("5");
  });

  it("live-events-minprice-0: minPrice=0 不透传（stub 不收到 minPrice）", async () => {
    await fetchEvents("?type=gift&minPrice=0", memberJar);
    const qs = new URLSearchParams(lastRangeSearch);
    expect(qs.has("minPrice")).toBe(false);
  });

  it("live-events-minprice-absent: 不带 minPrice 时 stub 不收到 minPrice", async () => {
    await fetchEvents("?type=gift", memberJar);
    const qs = new URLSearchParams(lastRangeSearch);
    expect(qs.has("minPrice")).toBe(false);
  });

  it("live-events-400-minprice: minPrice 非法 → 400 且返回 { error }", async () => {
    for (const query of ["?minPrice=abc", "?minPrice=-1", "?minPrice=101"]) {
      const res = await request(`/api/live-events${query}`, { jar: memberJar });
      expect(res.status).toBe(400);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });
});

describe("live-events 已读状态", () => {
  it("live-events-read: 单条已读幂等，检索合并 read:true；eventId 缺失/为空 400", async () => {
    const before = await fetchEvents("?type=guard_buy", memberJar);
    const target = before.items[0];

    const bad1 = await request("/api/live-events/read", { method: "POST", body: {}, jar: adminJar });
    expect(bad1.status).toBe(400);
    expect(typeof (bad1.body as { error?: unknown })?.error).toBe("string");
    const bad2 = await request("/api/live-events/read", { method: "POST", body: { eventId: "" }, jar: adminJar });
    expect(bad2.status).toBe(400);

    const r1 = await request("/api/live-events/read", {
      method: "POST",
      body: { eventId: target.eventId },
      jar: adminJar,
    });
    expect(r1.status).toBe(200);
    expect((r1.body as { ok?: unknown }).ok).toBe(true);
    // 幂等：重复调用返回相同结果
    const r2 = await request("/api/live-events/read", {
      method: "POST",
      body: { eventId: target.eventId },
      jar: adminJar,
    });
    expect(r2.status).toBe(200);
    expect((r2.body as { ok?: unknown }).ok).toBe(true);

    const after = await fetchEvents("?type=guard_buy", memberJar);
    const marked = after.items.find((e) => e.eventId === target.eventId);
    expect(marked?.read).toBe(true);
  });

  it("live-events-unread: 取消已读幂等且与 read 交叉覆盖", async () => {
    const before = await fetchEvents("?type=guard_buy", memberJar);
    const target = before.items[0];

    const bad = await request("/api/live-events/unread", { method: "POST", body: {}, jar: adminJar });
    expect(bad.status).toBe(400);

    const u1 = await request("/api/live-events/unread", {
      method: "POST",
      body: { eventId: target.eventId },
      jar: adminJar,
    });
    expect(u1.status).toBe(200);
    expect((u1.body as { ok?: unknown }).ok).toBe(true);
    const u2 = await request("/api/live-events/unread", {
      method: "POST",
      body: { eventId: target.eventId },
      jar: adminJar,
    });
    expect(u2.status).toBe(200);

    let page = await fetchEvents("?type=guard_buy", memberJar);
    expect(page.items.find((e) => e.eventId === target.eventId)?.read).toBe(false);

    // 交叉覆盖：再次 read 后回到已读
    const r = await request("/api/live-events/read", {
      method: "POST",
      body: { eventId: target.eventId },
      jar: adminJar,
    });
    expect(r.status).toBe(200);
    page = await fetchEvents("?type=guard_buy", memberJar);
    expect(page.items.find((e) => e.eventId === target.eventId)?.read).toBe(true);
  });

  it("live-events-read-all: 按类型全部已读后旧事件均已读；type 缺失/非法 400", async () => {
    const bad1 = await request("/api/live-events/read-all", { method: "POST", body: {}, jar: adminJar });
    expect(bad1.status).toBe(400);
    const bad2 = await request("/api/live-events/read-all", {
      method: "POST",
      body: { type: "danmaku" },
      jar: adminJar,
    });
    expect(bad2.status).toBe(400);

    const res = await request("/api/live-events/read-all", {
      method: "POST",
      body: { type: "super_chat" },
      jar: adminJar,
    });
    expect(res.status).toBe(200);
    const body = res.body as { ok?: unknown; marked?: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.marked).toBe("number");
    expect(body.marked as number).toBeGreaterThanOrEqual(0);

    const page = await fetchEvents("?type=super_chat&pageSize=100", memberJar);
    expect(page.items.length).toBeGreaterThan(0);
    for (const ev of page.items) {
      expect(ev.read).toBe(true);
    }
  });

  it("live-events-eventId-400: read/unread 前缀非法（如 watermark:super_chat）→ 400 中文错误", async () => {
    for (const path of ["/api/live-events/read", "/api/live-events/unread"]) {
      const res = await request(path, {
        method: "POST",
        body: { eventId: "watermark:super_chat" },
        jar: adminJar,
      });
      expect(res.status).toBe(400);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });

  it("live-events-read-all-guard: guard_buy 全部已读水位线生效", async () => {
    const res = await request("/api/live-events/read-all", {
      method: "POST",
      body: { type: "guard_buy" },
      jar: adminJar,
    });
    expect(res.status).toBe(200);
    const body = res.body as { ok?: unknown; marked?: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.marked).toBe("number");

    const page = await fetchEvents("?type=guard_buy&pageSize=100", memberJar);
    expect(page.items.length).toBeGreaterThan(0);
    for (const ev of page.items) {
      expect(ev.read).toBe(true);
    }
  });

  it("live-events-read-all-empty: 该类型无事件 → 200 marked=0", async () => {
    rangeMode = "empty";
    try {
      const res = await request("/api/live-events/read-all", {
        method: "POST",
        body: { type: "super_chat" },
        jar: adminJar,
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, marked: 0 });
    } finally {
      rangeMode = "ok";
    }
  });

  it("live-events-read-all-502: 上游 5xx → 502 中文错误", async () => {
    rangeMode = "error";
    try {
      const res = await request("/api/live-events/read-all", {
        method: "POST",
        body: { type: "guard_buy" },
        jar: adminJar,
      });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "上游事件服务不可用" });
    } finally {
      rangeMode = "ok";
    }
  });

  it("live-events-unread-after-read-all: unread 单条撤销水位线覆盖", async () => {
    // 自建前置水位线（幂等、只前进不后退），不依赖前序用例，可单跑
    const markAll = await request("/api/live-events/read-all", {
      method: "POST",
      body: { type: "super_chat" },
      jar: adminJar,
    });
    expect(markAll.status).toBe(200);

    const page = await fetchEvents("?type=super_chat&pageSize=100", memberJar);
    // 取最旧一条（水位线语义下必然被覆盖为已读）
    const target = page.items[page.items.length - 1];
    expect(target.read).toBe(true);

    try {
      const res = await request("/api/live-events/unread", {
        method: "POST",
        body: { eventId: target.eventId },
        jar: adminJar,
      });
      expect(res.status).toBe(200);

      const after = await fetchEvents("?type=super_chat&pageSize=100", memberJar);
      const revoked = after.items.find((e) => e.eventId === target.eventId);
      expect(revoked?.read).toBe(false);
      // 其余条目仍被水位线覆盖为已读
      for (const ev of after.items.filter((e) => e.eventId !== target.eventId)) {
        expect(ev.read).toBe(true);
      }
    } finally {
      // 恢复已读基态（read 幂等）：显式 unread 记录持久化在 MongoDB，
      // 残留会破坏「read-all 后全部已读」断言，导致套件无法重复运行
      await request("/api/live-events/read", {
        method: "POST",
        body: { eventId: target.eventId },
        jar: adminJar,
      });
    }
  });
});

describe("GET /api/live-events/stream（SSE）", () => {
  it("live-events-sse-400: type 含非法值 → 400（不建立 SSE 流）", async () => {
    const res = await openStream("?type=entry_effect", memberJar);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: unknown };
    expect(typeof body.error).toBe("string");
  });

  it("live-events-sse-events: member 连接收到归一化事件帧，type 过滤透传上游", async () => {
    const res = await openStream("?type=super_chat", memberJar);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/event-stream");

    const text = await collectSse(res, (t) => parseSseFrames(t).length >= 1, 10_000);
    const frames = parseSseFrames(text);
    expect(frames.length).toBeGreaterThanOrEqual(1);
    for (const ev of frames) {
      expectLiveEventShape(ev);
      expect(ev.type).toBe("super_chat");
    }
    expect(lastSubscribeTypes).toEqual(["super_chat"]);
  });

  it("live-events-sse-read-merged: SSE 帧合并已读状态（单条已读 read=true，其余 false）", async () => {
    // 用 gift 类型避免水位线干扰（read-all 仅支持 super_chat/guard_buy）；
    // stub 订阅首两帧按 occurredAt 倒序为 gift:batch-stub-5 / gift:batch-stub-4
    const mark = await request("/api/live-events/read", {
      method: "POST",
      body: { eventId: "gift:batch-stub-5" },
      jar: adminJar,
    });
    expect(mark.status).toBe(200);

    const res = await openStream("?type=gift", memberJar);
    expect(res.status).toBe(200);
    const text = await collectSse(res, (t) => parseSseFrames(t).length >= 2, 10_000);
    const byId = new Map(parseSseFrames(text).map((f) => [f.eventId, f]));
    expect(byId.get("gift:batch-stub-5")?.read).toBe(true);
    expect(byId.get("gift:batch-stub-4")?.read).toBe(false);
  });

  it(
    "live-events-sse-heartbeat: 30s 收到 : ping 注释心跳",
    async () => {
      const res = await openStream("", memberJar);
      expect(res.status).toBe(200);
      // 心跳间隔 30s，留 8s 余量
      const text = await collectSse(res, (t) => /(^|\n):\s*ping/.test(t), 38_000);
      expect(/(^|\n):\s*ping/.test(text)).toBe(true);
    },
    45_000,
  );
});
