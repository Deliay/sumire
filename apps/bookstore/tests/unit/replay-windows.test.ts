import { describe, it, expect } from "vitest";
import {
  MAX_RANGE_MS,
  WINDOW_MS,
  offsetMs,
  segmentBoundsForFile,
  windowBounds,
  windowIndexForOffset,
} from "@/features/recordings/replay/replayWindows";
import type { RecordingFile } from "@/features/recordings/api";

const START = "2026-09-17T10:00:00.000Z";
const START_MS = Date.parse(START);

describe("replayWindows 窗口切分", () => {
  it("windowIndexForOffset = floor(offsetMs / 600000)，负偏移钳制到 0", () => {
    expect(windowIndexForOffset(0)).toBe(0);
    expect(windowIndexForOffset(WINDOW_MS - 1)).toBe(0);
    expect(windowIndexForOffset(WINDOW_MS)).toBe(1);
    expect(windowIndexForOffset(WINDOW_MS * 3 + 123)).toBe(3);
    expect(windowIndexForOffset(-5000)).toBe(0);
  });

  it("offsetMs = occurredAt - recordStart", () => {
    expect(offsetMs("2026-09-17T10:00:30.000Z", START)).toBe(30_000);
    expect(offsetMs("2026-09-17T10:11:00.000Z", START)).toBe(11 * 60 * 1000);
  });

  it("windowBounds：窗口起点按 recordStart 对齐，终点 +10min", () => {
    const { startMs, endMs } = windowBounds(2, START_MS, null);
    expect(startMs).toBe(START_MS + 2 * WINDOW_MS);
    expect(endMs).toBe(START_MS + 3 * WINDOW_MS);
  });

  it("windowBounds：末窗终点钳制到 recordEnd", () => {
    const recordEndMs = START_MS + WINDOW_MS + 42_000;
    const { startMs, endMs } = windowBounds(1, START_MS, recordEndMs);
    expect(startMs).toBe(START_MS + WINDOW_MS);
    expect(endMs).toBe(recordEndMs);
  });

  it("windowBounds：duration 未知时以 recordStart + 12h 为上界", () => {
    const { endMs } = windowBounds(0, START_MS, null);
    expect(endMs).toBe(START_MS + WINDOW_MS);

    const huge = windowBounds(2000, START_MS, null);
    expect(huge.endMs).toBe(START_MS + MAX_RANGE_MS);
  });

  it("windowBounds：recordEnd 早于窗口起点时终点钳制到 recordEnd（空窗）", () => {
    const recordEndMs = START_MS + 5_000;
    const { endMs } = windowBounds(1, START_MS, recordEndMs);
    expect(endMs).toBe(recordEndMs);
  });
});

describe("replayWindows 分段锚点推导（info 优先，createdAt 为分段结束）", () => {
  function file(name: string, createdAt: string, info?: RecordingFile["info"]): RecordingFile {
    return { name, size: 1, createdAt, ...(info ? { info } : {}) };
  }

  it("单段：start=info.startedAt，end=info.endedAt（createdAt 不作为起点）", () => {
    const info = {
      recordingId: "rec-1",
      title: "t",
      mid: 1,
      startedAt: "2026-09-16T03:57:56.277Z",
      endedAt: "2026-09-16T06:13:41.707Z",
    };
    const target = file("a.flv", "2026-09-16T06:13:41.707Z", info);
    const bounds = segmentBoundsForFile([target], target);
    expect(bounds.startMs).toBe(Date.parse(info.startedAt));
    expect(bounds.endMs).toBe(Date.parse(info.endedAt));
    expect(bounds.fallback).toBe(false);
  });

  it("多段：首段起于 info.startedAt、止于本段 createdAt；末段止于 info.endedAt", () => {
    const info = {
      recordingId: "rec-2",
      title: "t",
      mid: 1,
      startedAt: "2026-09-14T13:53:44.000Z",
      endedAt: "2026-09-14T16:29:24.409Z",
    };
    const seg1 = file("seg1.flv", "2026-09-14T14:56:42.980Z", info);
    const seg2 = file("seg2.flv", "2026-09-14T16:29:23.418Z", info);
    const files = [seg2, seg1]; // 乱序输入

    const b1 = segmentBoundsForFile(files, seg1);
    expect(b1.startMs).toBe(Date.parse(info.startedAt));
    expect(b1.endMs).toBe(Date.parse(seg1.createdAt));

    const b2 = segmentBoundsForFile(files, seg2);
    expect(b2.startMs).toBe(Date.parse(seg1.createdAt));
    expect(b2.endMs).toBe(Date.parse(info.endedAt));
  });

  it("info 缺失：回退 createdAt（fallback=true），终点交由 duration 兜底", () => {
    const target = file("a.flv", "2026-09-16T06:13:41.707Z");
    const bounds = segmentBoundsForFile([target], target);
    expect(bounds.startMs).toBe(Date.parse(target.createdAt));
    expect(bounds.endMs).toBeNull();
    expect(bounds.fallback).toBe(true);
  });

  it("recordingId 相同但无兄弟：按单段处理", () => {
    const info = {
      recordingId: "rec-3",
      title: "t",
      mid: 1,
      startedAt: "2026-09-16T03:00:00.000Z",
      endedAt: "2026-09-16T04:00:00.000Z",
    };
    const target = file("only.flv", "2026-09-16T04:00:00.000Z", info);
    const bounds = segmentBoundsForFile([target], target);
    expect(bounds.startMs).toBe(Date.parse(info.startedAt));
    expect(bounds.endMs).toBe(Date.parse(info.endedAt));
  });
});
