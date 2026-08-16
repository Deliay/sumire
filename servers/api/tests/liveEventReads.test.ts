import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LiveEventReadModel,
  typeFromEventId,
  watermarkEventId,
  markRead,
  markUnread,
  markAllRead,
  resolveReadState,
  computeRead,
} from "../src/db/liveEventReads";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("typeFromEventId / watermarkEventId", () => {
  it("eventId 前缀映射事件类型", () => {
    expect(typeFromEventId("dm:123")).toBe("danmaku");
    expect(typeFromEventId("sc:7788123")).toBe("super_chat");
    expect(typeFromEventId("gift:batch:1")).toBe("gift");
    expect(typeFromEventId("guard:437917:1755338730")).toBe("guard_buy");
    expect(typeFromEventId("weird:1")).toBeNull();
  });

  it("水位线记录 eventId 为 watermark:{type}", () => {
    expect(watermarkEventId("super_chat")).toBe("watermark:super_chat");
  });
});

describe("markRead / markUnread（幂等 upsert，kind 覆盖）", () => {
  it("markRead：同一 eventId upsert，kind=read，type 由 eventId 派生", async () => {
    const spy = vi.spyOn(LiveEventReadModel, "updateOne").mockResolvedValue({ acknowledged: true } as never);
    await markRead("sc:7788123", "admin1");
    await markRead("sc:7788123", "admin1");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(
      { eventId: "sc:7788123" },
      expect.objectContaining({
        $set: expect.objectContaining({ kind: "read", type: "super_chat", readBy: "admin1" }),
      }),
      { upsert: true },
    );
  });

  it("markUnread：同一 eventId upsert，kind=unread（覆盖 read）", async () => {
    const spy = vi.spyOn(LiveEventReadModel, "updateOne").mockResolvedValue({ acknowledged: true } as never);
    await markUnread("guard:437917:1755338730", "admin1");
    expect(spy).toHaveBeenCalledWith(
      { eventId: "guard:437917:1755338730" },
      expect.objectContaining({
        $set: expect.objectContaining({ kind: "unread", type: "guard_buy" }),
      }),
      { upsert: true },
    );
  });
});

describe("markAllRead（水位线 upsert，$max 只前进不后退）", () => {
  it("写入 watermark:{type} 记录且 readBefore 用 $max", async () => {
    const spy = vi.spyOn(LiveEventReadModel, "updateOne").mockResolvedValue({ acknowledged: true } as never);
    const readBefore = new Date("2026-08-16T13:25:30.000Z");
    await markAllRead("super_chat", readBefore, "admin1");
    expect(spy).toHaveBeenCalledWith(
      { eventId: "watermark:super_chat" },
      expect.objectContaining({
        $set: expect.objectContaining({ kind: "watermark", type: "super_chat", readBy: "admin1" }),
        $max: { readBefore },
      }),
      { upsert: true },
    );
  });
});

describe("computeRead 已读判定规则（提案 §4.1）", () => {
  const wm = new Date("2026-08-16T13:00:00.000Z");

  it("无单条记录无水位线 → 未读", () => {
    expect(computeRead(undefined, undefined, "2026-08-16T12:00:00.000Z")).toBe(false);
  });

  it("无单条记录，occurredAt <= 水位线 → 已读", () => {
    expect(computeRead(undefined, wm, "2026-08-16T12:00:00.000Z")).toBe(true);
    expect(computeRead(undefined, wm, "2026-08-16T13:00:00.000Z")).toBe(true);
  });

  it("无单条记录，occurredAt > 水位线 → 未读", () => {
    expect(computeRead(undefined, wm, "2026-08-16T14:00:00.000Z")).toBe(false);
  });

  it("单条 read 优先于水位线（水位线之外的新事件被单条标记）", () => {
    expect(computeRead("read", wm, "2026-08-16T14:00:00.000Z")).toBe(true);
  });

  it("单条 unread 显式撤销水位线覆盖", () => {
    expect(computeRead("unread", wm, "2026-08-16T12:00:00.000Z")).toBe(false);
  });
});

describe("resolveReadState（单条记录 + 水位线批量合并）", () => {
  function stubFind(singles: unknown[], watermarks: unknown[]) {
    return vi.spyOn(LiveEventReadModel, "find").mockImplementation(((filter: { kind: unknown }) => {
      const kinds = JSON.stringify(filter.kind);
      const docs = kinds.includes("watermark") && !kinds.includes("read") ? watermarks : singles;
      return { lean: async () => docs } as never;
    }) as never);
  }

  it("单条记录优先于水位线；同类型多水位线取最新", async () => {
    const findSpy = stubFind(
      [
        { eventId: "sc:1", kind: "read" },
        { eventId: "sc:2", kind: "unread" },
      ],
      [
        { eventId: "watermark:super_chat", type: "super_chat", kind: "watermark", readBefore: new Date("2026-08-16T12:00:00Z") },
        { eventId: "watermark:super_chat", type: "super_chat", kind: "watermark", readBefore: new Date("2026-08-16T13:00:00Z") },
      ],
    );
    const events = [
      { eventId: "sc:1", type: "super_chat", occurredAt: "2026-08-16T14:00:00Z" }, // 水位线之外，单条 read → true
      { eventId: "sc:2", type: "super_chat", occurredAt: "2026-08-16T11:00:00Z" }, // 水位线之内，单条 unread → false
      { eventId: "sc:3", type: "super_chat", occurredAt: "2026-08-16T12:30:00Z" }, // 最新水位线之内 → true
      { eventId: "sc:4", type: "super_chat", occurredAt: "2026-08-16T14:00:00Z" }, // 水位线之外 → false
      { eventId: "dm:1", type: "danmaku", occurredAt: "2026-08-16T11:00:00Z" }, // 无水位线 → false
    ];
    const out = await resolveReadState(events);
    expect(out.map((e) => e.read)).toEqual([true, false, true, false, false]);
    expect(findSpy).toHaveBeenCalled();
    // 查询条件：单条记录按 eventId $in，水位线按 kind + type $in
    const filters = (findSpy.mock.calls as unknown[][]).map((c) => c[0]);
    expect(JSON.stringify(filters)).toContain("watermark");
  });

  it("空数组短路，不查库", async () => {
    const findSpy = vi.spyOn(LiveEventReadModel, "find");
    expect(await resolveReadState([])).toEqual([]);
    expect(findSpy).not.toHaveBeenCalled();
  });
});
