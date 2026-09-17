import { describe, it, expect } from "vitest";
import {
  BASE_FONT_SIZE,
  LANE_HEIGHT,
  MAX_ACTIVE_DANMAKU,
  MIN_FONT_SIZE,
  assignLane,
  danmakuOffsets,
  danmakuSpeed,
  fontSizeForWidth,
  isSeekJump,
  laneCountForWidth,
  laneHeightForWidth,
  selectDanmakusToEmit,
  type ActiveDanmaku,
} from "@/features/recordings/replay/danmakuOverlay";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = {
  uid: 1,
  name: "观众",
  nameRomaji: null,
  face: null,
  medal: null,
  guardLevel: null,
};

function event(eventId: string, occurredAt: string, content = "hi"): LiveEvent {
  return { eventId, type: "danmaku", occurredAt, sender: SENDER, content, read: false };
}

describe("assignLane 轨道分配", () => {
  it("轨道尾部弹幕右缘已完全进入并留出间距：复用该轨道", () => {
    const active: ActiveDanmaku[] = [{ lane: 0, x: 800, width: 100, speed: 240 }];
    expect(assignLane(active, 1920, 4)).toBe(0);
  });

  it("轨道尾部弹幕尚未走完：跳到下一轨道", () => {
    const active: ActiveDanmaku[] = [{ lane: 0, x: 1850, width: 100, speed: 240 }];
    expect(assignLane(active, 1920, 4)).toBe(1);
  });

  it("全部轨道被占用：返回 null（丢弃）", () => {
    const active: ActiveDanmaku[] = [
      { lane: 0, x: 1900, width: 100, speed: 240 },
      { lane: 1, x: 1900, width: 100, speed: 240 },
      { lane: 2, x: 1900, width: 100, speed: 240 },
      { lane: 3, x: 1900, width: 100, speed: 240 },
    ];
    expect(assignLane(active, 1920, 4)).toBeNull();
  });

  it("同屏在飞数量达上限：直接返回 null 丢弃", () => {
    const active: ActiveDanmaku[] = Array.from({ length: MAX_ACTIVE_DANMAKU }, (_, i) => ({
      lane: i % 4,
      x: 10,
      width: 100,
      speed: 240,
    }));
    expect(assignLane(active, 1920, 4)).toBeNull();
  });
});

describe("字号与速度", () => {
  it("字号随宽度缩放，基准 32px @1920", () => {
    expect(fontSizeForWidth(1920)).toBe(BASE_FONT_SIZE);
    expect(fontSizeForWidth(3840)).toBe(BASE_FONT_SIZE * 2);
    expect(fontSizeForWidth(2400)).toBe(40);
    // 非法输入回退基准
    expect(fontSizeForWidth(0)).toBe(BASE_FONT_SIZE);
    expect(fontSizeForWidth(Number.NaN)).toBe(BASE_FONT_SIZE);
  });

  it("窄舞台字号钳到下限 MIN_FONT_SIZE（20px），不再缩到十几像素", () => {
    expect(fontSizeForWidth(900)).toBe(MIN_FONT_SIZE);
    expect(fontSizeForWidth(1200)).toBe(MIN_FONT_SIZE);
    expect(fontSizeForWidth(960)).toBe(MIN_FONT_SIZE);
    // 恰好线性缩放值低于下限时取下限
    expect(fontSizeForWidth(600)).toBe(MIN_FONT_SIZE);
    expect(fontSizeForWidth(900)).toBeGreaterThanOrEqual(20);
  });

  it("轨道高度随字号放大且不低于 LANE_HEIGHT，轨道数随之收敛", () => {
    expect(laneHeightForWidth(900)).toBeGreaterThanOrEqual(LANE_HEIGHT);
    expect(laneHeightForWidth(1920)).toBeGreaterThanOrEqual(LANE_HEIGHT);
    expect(laneHeightForWidth(1920)).toBeGreaterThan(laneHeightForWidth(900));
    expect(laneCountForWidth(1920)).toBeGreaterThan(0);
    expect(laneCountForWidth(0)).toBe(1);
  });

  it("速度恒定（像素/秒），与弹幕文本长度无关", () => {
    expect(danmakuSpeed(1920)).toBe(danmakuSpeed(1920));
    expect(danmakuSpeed(1920)).toBeGreaterThan(0);
    expect(danmakuSpeed(0)).toBe(0);
  });
});

describe("弹幕调度纯函数", () => {
  const START = "2026-09-17T10:00:00.000Z";

  it("danmakuOffsets 映射事件到相对秒（仅 danmaku 类型）", () => {
    const events = [
      event("dm:1", "2026-09-17T10:00:05.000Z"),
      { ...event("sc:1", "2026-09-17T10:00:06.000Z"), type: "super_chat" as const },
      event("dm:2", "2026-09-17T10:00:07.000Z"),
    ];
    const offsets = danmakuOffsets(events, START);
    expect(offsets.map((o) => o.offsetSeconds)).toEqual([5, 7]);
  });

  it("播放前进：只发射 (prev, next] 区间内的事件", () => {
    const offsets = [
      { event: event("a", START), offsetSeconds: 1 },
      { event: event("b", START), offsetSeconds: 5 },
      { event: event("c", START), offsetSeconds: 9 },
    ];
    const selected = selectDanmakusToEmit(offsets, 0, 5);
    expect(selected.map((o) => o.event.eventId)).toEqual(["a", "b"]);
    expect(selectDanmakusToEmit(offsets, 5, 8)).toEqual([]);
  });

  it("isSeekJump：回退或跳幅超过阈值判为 seek", () => {
    expect(isSeekJump(10, 11)).toBe(false);
    expect(isSeekJump(10, 9)).toBe(true);
    expect(isSeekJump(10, 30)).toBe(true);
  });
});
