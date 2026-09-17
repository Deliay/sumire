import { describe, it, expect } from "vitest";
import {
  MAX_RANGE_MS,
  WINDOW_MS,
  offsetMs,
  windowBounds,
  windowIndexForOffset,
} from "@/features/recordings/replay/replayWindows";

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
