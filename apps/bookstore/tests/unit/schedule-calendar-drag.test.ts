import { describe, it, expect } from "vitest";
import { createDrag, feedPointer, release, DRAG_THRESHOLD } from "@/features/schedule/calendarDrag";

describe("calendarDrag 横向拖拽翻月", () => {
  it("左拖（dx 负）超阈值 → 下月 1", () => {
    const d = createDrag();
    feedPointer(d, -DRAG_THRESHOLD - 10);
    expect(release(d)).toBe(1);
  });

  it("右拖（dx 正）超阈值 → 上月 -1", () => {
    const d = createDrag();
    feedPointer(d, DRAG_THRESHOLD + 10);
    expect(release(d)).toBe(-1);
  });

  it("阈值内 → 0", () => {
    const d = createDrag();
    feedPointer(d, -10);
    expect(release(d)).toBe(0);
  });

  it("多次 feed 累积超过阈值", () => {
    const d = createDrag();
    feedPointer(d, -20);
    feedPointer(d, -20);
    feedPointer(d, -20);
    feedPointer(d, -20);
    feedPointer(d, -20);
    expect(release(d)).toBe(1);
  });

  it("release 后状态归零可复用", () => {
    const d = createDrag();
    feedPointer(d, -DRAG_THRESHOLD - 10);
    expect(release(d)).toBe(1);
    expect(release(d)).toBe(0);
    feedPointer(d, DRAG_THRESHOLD + 10);
    expect(release(d)).toBe(-1);
  });
});