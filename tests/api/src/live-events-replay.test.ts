import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { request, waitForReady } from "./client.js";

const API_BASE_URL = process.env.API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("缺少环境变量 API_BASE_URL（通过 aspire describe api 获取端点注入）");
}

// 复用 live-events 的 stub 端口（与 live-history 9876 隔离）；
// 须与 Aspire 启动时注入的 LIVE_EVENTS_UPSTREAM_URL 端口一致
const STUB_PORT = Number(process.env.LIVE_EVENTS_STUB_PORT ?? "9877");
const EVENT_PREFIX = "/api/b/live/1727076670";

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
  info[3] = [5, "堇色粉", "枝堇Sumire", 0, 0, 0, 11_839_167];
  info[15] = {
    extra: JSON.stringify({ id_str: `dm-stub-${String(i).padStart(3, "0")}`, content: `弹幕内容${i}` }),
    user: {
      uid: 10_000 + i,
      base: { name: `观众${i}`, face: "https://example.com/face.jpg" },
      medal: { name: "堇色粉", level: 5, color: "#b4a6bf" },
    },
  };
  return { roomId: 1727076670, type: "danmaku", occurredAt: at(min), liveSessionId: "session-stub-1", payload: { info } };
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

function giftV2(i: number, min: number): StubEnvelope {
  return {
    roomId: 1727076670,
    type: "gift_v2",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: {
      data: {
        senderUinfo: {
          uid: 50_000 + i,
          base: { name: `礼物V2用户${i}`, face: "https://example.com/gift-v2-face.jpg" },
          medal: { name: "堇色粉", level: 12, color: "#b4a6bf" },
        },
        giftList: {
          batchComboId: `batch-v2-stub-${i}`,
          giftId: 1000 + i,
          giftName: "小花花V2",
          num: 2,
          coinType: "gold",
          comboTotalCoin: 2000,
          timestamp: Date.now() + i,
          giftInfo: { imgBasic: "https://example.com/gift-v2-icon.jpg" },
        },
        uid: 50_000 + i,
        uname: `礼物V2用户${i}`,
        face: "https://example.com/gift-v2-face.jpg",
        medalInfo: { medalName: "堇色粉", medalLevel: 12, medalColor: "#b4a6bf" },
        guardLevel: 0,
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

function onlineRankCount(i: number, min: number): StubEnvelope {
  return {
    roomId: 1727076670,
    type: "online_rank_count",
    occurredAt: at(min),
    liveSessionId: "session-stub-1",
    payload: { online_count: 1500 + i },
  };
}

/** 确定性数据集：弹幕×12 / SC×8 / 礼物×6 / 礼物V2×4 / 上船×6 / 在线人数×3，共 39 条。 */
function dataset(): StubEnvelope[] {
  const events: StubEnvelope[] = [];
  for (let i = 0; i < 12; i++) events.push(danmaku(i, i));
  for (let i = 0; i < 8; i++) events.push(superChat(i, 12 + i));
  for (let i = 0; i < 6; i++) events.push(gift(i, 20 + i));
  for (let i = 0; i < 4; i++) events.push(giftV2(i, 26 + i));
  for (let i = 0; i < 6; i++) events.push(guardBuy(i, 30 + i));
  for (let i = 0; i < 3; i++) events.push(onlineRankCount(i, 36 + i));
  return events;
}

const ALL_EVENTS = dataset();

/** 模拟上游：按 type 过滤（缺省全部），按 occurredAt 倒序分页；忽略未知参数（start/end 等）。 */
function filterByTypes(types: string[]): StubEnvelope[] {
  const filtered = types.length > 0 ? ALL_EVENTS.filter((e) => types.includes(e.type)) : [...ALL_EVENTS];
  return filtered.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

let rangeMode: "ok" | "error" = "ok";
let rangeRequests = 0;

function startStub(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === `${EVENT_PREFIX}/event/range`) {
      rangeRequests += 1;
      if (rangeMode === "error") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "stub upstream broken" }));
        return;
      }
      const types = url.searchParams.getAll("type");
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "100");
      const filtered = filterByTypes(types);
      const items = filtered.slice((page - 1) * pageSize, page * pageSize);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: filtered.length, page, pageSize, items }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

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

interface ReplayItem {
  eventId: string;
  type: string;
  occurredAt: string;
  sender: { uid: number; name: string; face: unknown; medal: unknown; guardLevel?: unknown };
  [key: string]: unknown;
}

interface ReplayPage {
  total: number;
  page: number;
  pageSize: number;
  items: ReplayItem[];
}

const START = at(-1);
const END = at(60);
const RANGE = `start=${encodeURIComponent(START)}&end=${encodeURIComponent(END)}`;

async function fetchReplay(query: string): Promise<ReplayPage> {
  const res = await request(`/api/live-events/replay?${query}`);
  expect(res.status).toBe(200);
  return res.body as ReplayPage;
}

let stub: Server;

beforeAll(async () => {
  stub = startStub();
  await listenStub(stub);
  await waitForReady();
});

afterAll(async () => {
  if (stub) await new Promise<void>((resolve) => stub.close(() => resolve()));
});

describe("GET /api/live-events/replay（公开回放检索）", () => {
  it("live-events-replay-shape: 匿名 200，升序、全部落在区间、字段裁剪", async () => {
    const body = await fetchReplay(RANGE);
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(Array.isArray(body.items)).toBe(true);
    // 缺省四类，不含 online_rank_count（39 - 3 = 36）
    expect(body.total).toBe(36);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(100);

    const times = body.items.map((i) => new Date(i.occurredAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(new Date(START).getTime());
      expect(t).toBeLessThanOrEqual(new Date(END).getTime());
    }
    for (const item of body.items) {
      expect(["danmaku", "super_chat", "gift", "guard_buy"]).toContain(item.type);
      expect(item).not.toHaveProperty("read");
      expect(item).not.toHaveProperty("contentRomaji");
      expect(item.sender).not.toHaveProperty("nameRomaji");
      expect(typeof item.sender.uid).toBe("number");
      expect(typeof item.sender.name).toBe("string");
      expect("face" in item.sender).toBe(true);
      expect("medal" in item.sender).toBe(true);
    }
  });

  it("live-events-replay-types: type=gift 扩展 gift_v2，响应仅含 gift；多 type 组合", async () => {
    const giftBody = await fetchReplay(`${RANGE}&type=gift`);
    expect(giftBody.total).toBe(10); // 礼物×6 + 礼物V2×4
    for (const item of giftBody.items) {
      expect(item.type).toBe("gift");
      expect(item.eventId).toMatch(/^gift:/);
    }

    const mixed = await fetchReplay(`${RANGE}&type=danmaku&type=super_chat`);
    expect(mixed.total).toBe(20); // 弹幕×12 + SC×8
    for (const item of mixed.items) {
      expect(["danmaku", "super_chat"]).toContain(item.type);
    }
  });

  it("live-events-replay-ascending: 区间内事件按 occurredAt 升序（首条最早、末条最晚）", async () => {
    const body = await fetchReplay(`${RANGE}&type=danmaku`);
    expect(body.total).toBe(12);
    expect(body.items[0].eventId).toBe("dm:dm-stub-000");
    expect(body.items[body.items.length - 1].eventId).toBe("dm:dm-stub-011");
  });

  it("live-events-replay-pagination: page/pageSize 对区间结果切片", async () => {
    const body = await fetchReplay(`${RANGE}&page=2&pageSize=10`);
    expect(body.total).toBe(36);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
    expect(body.items).toHaveLength(10);
  });

  it("live-events-replay-400: 各参数非法分支均 400 且返回 { error }", async () => {
    const paths = [
      "/api/live-events/replay",
      `/api/live-events/replay?start=${encodeURIComponent(START)}`,
      `/api/live-events/replay?start=abc&end=${encodeURIComponent(END)}`,
      `/api/live-events/replay?start=${encodeURIComponent(END)}&end=${encodeURIComponent(START)}`,
      `/api/live-events/replay?start=${encodeURIComponent(START)}&end=${encodeURIComponent(at(13 * 60))}`,
      `/api/live-events/replay?${RANGE}&type=online_rank_count`,
      `/api/live-events/replay?${RANGE}&type=entry_effect`,
      `/api/live-events/replay?${RANGE}&page=0`,
      `/api/live-events/replay?${RANGE}&page=abc`,
      `/api/live-events/replay?${RANGE}&pageSize=0`,
      `/api/live-events/replay?${RANGE}&pageSize=101`,
    ];
    for (const path of paths) {
      const res = await request(path);
      expect(res.status).toBe(400);
      expect(typeof (res.body as { error?: unknown })?.error).toBe("string");
    }
  });

  it("live-events-replay-502: 上游 5xx → 502 中文错误", async () => {
    // 用随机未来区间规避前序用例写入的 Redis 缓存命中（缓存命中会直接返回 200）
    const randStart = Date.UTC(2036, 0, 1) + Math.floor(Math.random() * 300) * 86_400_000;
    const randEnd = randStart + 3_600_000;
    const query = `start=${encodeURIComponent(new Date(randStart).toISOString())}&end=${encodeURIComponent(
      new Date(randEnd).toISOString(),
    )}`;
    rangeMode = "error";
    try {
      const res = await request(`/api/live-events/replay?${query}`);
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "上游事件服务不可用" });
    } finally {
      rangeMode = "ok";
    }
  });

  it("live-events-replay-cache: 同参数二次请求命中缓存，上游不再回源", async () => {
    // 随机未来区间避免跨轮次 Redis 缓存残留干扰计数
    const randStart = Date.UTC(2035, 0, 1) + Math.floor(Math.random() * 300) * 86_400_000;
    const randEnd = randStart + 3_600_000;
    const query = `start=${encodeURIComponent(new Date(randStart).toISOString())}&end=${encodeURIComponent(
      new Date(randEnd).toISOString(),
    )}`;
    const before = rangeRequests;
    await fetchReplay(query);
    expect(rangeRequests - before).toBe(1);
    await fetchReplay(query);
    expect(rangeRequests - before).toBe(1);
  });
});
