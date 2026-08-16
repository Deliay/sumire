import { describe, it, expect, vi, afterEach } from "vitest";
import { toLiveEvent } from "../src/liveEvents/normalize";
import danmakuFixture from "./fixtures/live-events/danmaku.json";
import superChatFixture from "./fixtures/live-events/super_chat.json";
import giftFixture from "./fixtures/live-events/gift.json";
import guardBuyFixture from "./fixtures/live-events/guard_buy.json";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toLiveEvent 四类事件映射（实测样本夹具）", () => {
  it("danmaku：uid/name 取经典数组 info[2]，face/medal 取 dm_v2，eventId = dm:{extra.id_str}", () => {
    const e = toLiveEvent(clone(danmakuFixture));
    expect(e).not.toBeNull();
    expect(e).toEqual({
      eventId: "dm:6923001122334455",
      type: "danmaku",
      occurredAt: "2026-08-16T13:20:11.523Z",
      sender: {
        uid: 248197,
        name: "紫罗兰的信",
        face: "https://i0.hdslb.com/bfs/face/member/248197.jpg",
        medal: { name: "堇色信笺", level: 12, color: "#6680ff" },
      },
      content: "堇宝今天唱什么呀",
      read: false,
    });
  });

  it("super_chat：uinfo.base 昵称头像、medal_info 牌子、price 直接用元、scColors 映射", () => {
    const e = toLiveEvent(clone(superChatFixture));
    expect(e).not.toBeNull();
    expect(e).toEqual({
      eventId: "sc:7788123",
      type: "super_chat",
      occurredAt: "2026-08-16T13:22:40.101Z",
      sender: {
        uid: 322892,
        name: "薄荷糖",
        face: "https://i1.hdslb.com/bfs/face/member/322892.jpg",
        medal: { name: "堇色信笺", level: 18, color: "#c79eff" },
      },
      content: "堇宝辛苦了！今晚也超好听",
      price: 30,
      scColors: { backgroundStart: "#EDF5FF", backgroundEnd: "#A2C3EA", fontColor: "#7497CD" },
      read: false,
    });
  });

  it("gift：金瓜子 combo_total_coin/1000、连击数取 combo_send.combo_num、eventId 用 batch_combo_id", () => {
    const e = toLiveEvent(clone(giftFixture));
    expect(e).not.toBeNull();
    expect(e).toEqual({
      eventId: "gift:gift:batch:21568305:30607:1755338640",
      type: "gift",
      occurredAt: "2026-08-16T13:24:05.777Z",
      sender: {
        uid: 21568305,
        name: "浅眠风",
        face: "https://i2.hdslb.com/bfs/face/member/21568305.jpg",
        medal: { name: "堇色信笺", level: 9, color: "#00d1f9" },
      },
      price: 9,
      gift: { name: "打call", count: 3 },
      read: false,
    });
  });

  it("guard_buy：无头像置 null、无牌子置 null、price/1000、guard 信息映射", () => {
    const e = toLiveEvent(clone(guardBuyFixture));
    expect(e).not.toBeNull();
    expect(e).toEqual({
      eventId: "guard:437917:1755338730",
      type: "guard_buy",
      occurredAt: "2026-08-16T13:25:30.000Z",
      sender: { uid: 437917, name: "夜航星", face: null, medal: null },
      price: 138,
      guard: { level: 3, name: "舰长", count: 1 },
      read: false,
    });
  });
});

describe("toLiveEvent 缺字段容错", () => {
  it("danmaku：dm_v2 无 medal 时回退经典数组 info[3]（[0] 等级 [1] 牌名 [6] 颜色整数转 hex）", () => {
    const fixture = clone(danmakuFixture);
    const v2 = (fixture.payload.info[0] as unknown[])[15] as { user: Record<string, unknown> };
    delete v2.user.medal;
    const e = toLiveEvent(fixture);
    expect(e).not.toBeNull();
    expect(e?.sender.medal).toEqual({
      name: "堇色信笺",
      level: 12,
      color: `#${(12632257).toString(16).padStart(6, "0")}`,
    });
  });

  it("danmaku：经典数组牌子名为空 → medal 为 null", () => {
    const fixture = clone(danmakuFixture);
    const v2 = (fixture.payload.info[0] as unknown[])[15] as { user: Record<string, unknown> };
    delete v2.user.medal;
    (fixture.payload.info[3] as unknown[])[1] = "";
    const e = toLiveEvent(fixture);
    expect(e?.sender.medal).toBeNull();
  });

  it("danmaku：dm_v2 缺 user.base.face → face 为 null", () => {
    const fixture = clone(danmakuFixture);
    const v2 = (fixture.payload.info[0] as unknown[])[15] as { user: { base: Record<string, unknown> } };
    delete v2.user.base.face;
    const e = toLiveEvent(fixture);
    expect(e?.sender.face).toBeNull();
  });

  it("danmaku：extra 已是对象（非 JSON 字符串）也能解析出 eventId 与内容", () => {
    const fixture = clone(danmakuFixture);
    const v2 = (fixture.payload.info[0] as unknown[])[15] as { extra: string };
    v2.extra = { id_str: "6923001122334455", content: "堇宝今天唱什么呀" } as unknown as string;
    const e = toLiveEvent(fixture);
    expect(e).not.toBeNull();
    expect(e?.eventId).toBe("dm:6923001122334455");
    expect(e?.content).toBe("堇宝今天唱什么呀");
  });

  it("danmaku：回归——同一用户多条消息必须得到不同 eventId（v2 在 info[0][15]，extra.id_str 唯一）", () => {
    const fixture = clone(danmakuFixture);
    const info = fixture.payload.info as unknown[];
    const i0 = info[0] as unknown[];
    const v2 = i0[15] as { extra: string };
    // 克隆第二份：同用户（info[2] 相同）、不同 id_str
    v2.extra = JSON.stringify({ id_str: "AAAA0000", content: "第一条", mode: 0 });
    const e1 = toLiveEvent(fixture);
    v2.extra = JSON.stringify({ id_str: "BBBB1111", content: "第二条", mode: 0 });
    const e2 = toLiveEvent(fixture);
    expect(e1).not.toBeNull();
    expect(e2).not.toBeNull();
    expect(e1?.eventId).toBe("dm:AAAA0000");
    expect(e2?.eventId).toBe("dm:BBBB1111");
    expect(e1?.eventId).not.toBe(e2?.eventId);
    expect(e1?.sender.uid).toBe(e2?.sender.uid);
  });

  it("danmaku：无 dm_v2（info[0][15] 缺失）时回退经典字段——eventId 用 info[0][7]、uid/name 用 info[2]、medal 用 info[3]", () => {
    const fixture = clone(danmakuFixture);
    (fixture.payload.info[0] as unknown[]).pop();
    const e = toLiveEvent(fixture);
    expect(e).not.toBeNull();
    expect(e?.eventId).toBe("dm:9f3c2a1d");
    expect(e?.sender.uid).toBe(248197);
    expect(e?.sender.name).toBe("紫罗兰的信");
    expect(e?.sender.face).toBeNull();
    expect(e?.sender.medal).toEqual({
      name: "堇色信笺",
      level: 12,
      color: `#${(12632257).toString(16).padStart(6, "0")}`,
    });
    expect(e?.content).toBe("堇宝今天唱什么呀");
  });

  it("danmaku：表情弹幕（info[0][13] 为 emoticon 对象）提取 emote.url 与 emote.name，仍保留 content", () => {
    const fixture = clone(danmakuFixture);
    const i0 = fixture.payload.info[0] as unknown[];
    i0[12] = 1;
    i0[13] = {
      bulge_display: 1,
      emoticon_unique: "room_1727076670_118056",
      height: 162,
      in_player_area: 1,
      is_dynamic: 0,
      url: "http://i0.hdslb.com/bfs/live/c6f3177115ef915da729d1b25708b69651ac5481.png",
      width: 162,
    };
    const e = toLiveEvent(fixture);
    expect(e).not.toBeNull();
    expect(e?.emote).toEqual({
      url: "http://i0.hdslb.com/bfs/live/c6f3177115ef915da729d1b25708b69651ac5481.png",
      name: "堇宝今天唱什么呀",
      width: 162,
      height: 162,
    });
    expect(e?.content).toBe("堇宝今天唱什么呀");
  });

  it("danmaku：info[0][13] 为字符串（非表情）时不带 emote 字段", () => {
    const fixture = clone(danmakuFixture);
    const i0 = fixture.payload.info[0] as unknown[];
    i0[12] = 0;
    i0[13] = "{}";
    const e = toLiveEvent(fixture);
    expect(e).not.toBeNull();
    expect(e?.emote).toBeUndefined();
  });

  it("super_chat：缺 data.uinfo 时回退 data.user_info", () => {
    const fixture = clone(superChatFixture);
    const data = fixture.payload.data as unknown as Record<string, unknown>;
    delete data.uinfo;
    data.user_info = { name: "薄荷糖", face: "https://i1.hdslb.com/bfs/face/member/322892.jpg" };
    const e = toLiveEvent(fixture);
    expect(e?.sender.name).toBe("薄荷糖");
    expect(e?.sender.face).toBe("https://i1.hdslb.com/bfs/face/member/322892.jpg");
  });

  it("super_chat：牌子名为空 → medal 为 null", () => {
    const fixture = clone(superChatFixture);
    (fixture.payload.data.medal_info as Record<string, unknown>).medal_name = "";
    const e = toLiveEvent(fixture);
    expect(e?.sender.medal).toBeNull();
  });

  it("gift：缺 combo_total_coin 时回退 discount_price/1000", () => {
    const fixture = clone(giftFixture);
    const data = fixture.payload.data as unknown as Record<string, unknown>;
    delete data.combo_total_coin;
    data.discount_price = 5000;
    const e = toLiveEvent(fixture);
    expect(e?.price).toBe(5);
  });

  it("gift：银瓜子（coin_type=silver）金额为 0", () => {
    const fixture = clone(giftFixture);
    (fixture.payload.data as unknown as Record<string, unknown>).coin_type = "silver";
    const e = toLiveEvent(fixture);
    expect(e?.price).toBe(0);
  });

  it("gift：COMBO_SEND 连击事件与 SEND_GIFT 同 batch_combo_id → eventId 相同（天然去重）", () => {
    const combo = clone(giftFixture);
    (combo.payload as Record<string, unknown>).cmd = "COMBO_SEND";
    const a = toLiveEvent(clone(giftFixture));
    const b = toLiveEvent(combo);
    expect(a?.eventId).toBe(b?.eventId);
  });

  it("gift：缺 batch_combo_id 时回退 combo_id", () => {
    const fixture = clone(giftFixture);
    delete (fixture.payload.data as unknown as Record<string, unknown>).batch_combo_id;
    const e = toLiveEvent(fixture);
    expect(e?.eventId).toBe("gift:gift:combo:21568305:30607:1755338640");
  });
});

describe("toLiveEvent eventId 稳定性", () => {
  it("同一信封重复归一化 eventId 相同", () => {
    const a = toLiveEvent(clone(danmakuFixture));
    const b = toLiveEvent(clone(danmakuFixture));
    expect(a?.eventId).toBe(b?.eventId);
  });
});

describe("toLiveEvent 解析失败 → null + console.warn（不抛断流）", () => {
  it.each([
    ["未知事件类型", { type: "entry_effect", occurredAt: "2026-08-16T13:00:00Z", payload: {} }],
    ["payload 非对象", { type: "danmaku", occurredAt: "2026-08-16T13:00:00Z", payload: "broken" }],
    ["danmaku 缺 dm_v2 extra.id_str", { type: "danmaku", occurredAt: "2026-08-16T13:00:00Z", payload: { cmd: "DANMU_MSG", info: [[], "x", [1, "u"]] } }],
    ["super_chat 缺 data.id", { type: "super_chat", occurredAt: "2026-08-16T13:00:00Z", payload: { cmd: "SUPER_CHAT_MESSAGE", data: { uid: 1, uinfo: { base: { name: "n" } } } } }],
    ["gift 缺 batch_combo_id 与 combo_id", { type: "gift", occurredAt: "2026-08-16T13:00:00Z", payload: { cmd: "SEND_GIFT", data: { uid: 1, uname: "n", giftName: "x" } } }],
    ["guard_buy 缺 start_time", { type: "guard_buy", occurredAt: "2026-08-16T13:00:00Z", payload: { cmd: "GUARD_BUY", data: { uid: 1, username: "n", guard_level: 3, num: 1, price: 138000, gift_name: "舰长" } } }],
  ])("%s", (_label, envelope) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toLiveEvent(envelope)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("输入非对象 → null", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toLiveEvent(null)).toBeNull();
    expect(toLiveEvent("x")).toBeNull();
    expect(toLiveEvent(42)).toBeNull();
  });

  it("信封 occurredAt 缺失 → null（不回退为「现在」参与水位线比较）", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fixture = clone(superChatFixture) as Record<string, unknown>;
    delete fixture.occurredAt;
    expect(toLiveEvent(fixture)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it("信封 occurredAt 非法（非时间字符串）→ null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fixture = clone(superChatFixture) as Record<string, unknown>;
    fixture.occurredAt = "not-a-date";
    expect(toLiveEvent(fixture)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
