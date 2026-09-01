import { describe, it, expect } from "vitest";
import {
  createGestureState,
  feedWheel,
  feedTouch,
  nextIndex,
  resolveFlowBoundary,
  easeInOutCubic,
  type GestureState,
} from "@/features/home/fullpage";

describe("createGestureState / feedWheel（一次手势一屏）", () => {
  it("同一次手势连续 delta 累加超阈值只产出一个意图", () => {
    let s = createGestureState();
    let out: { direction: 1 | -1 } | null = null;
    for (let i = 0; i < 10; i++) {
      const r = feedWheel(s, 20, i * 10);
      if (r) out = r;
    }
    // 累计 200，超阈值，仅向下一个意图（滚动向下 → 下一站 -1）
    expect(out).toEqual({ direction: -1 });
    // 冷却期内（now=100 < cooldown）不重复产出
    expect(feedWheel(s, 1000, 100)).toBeNull();
  });

  it("冷却期过后新手势可再次产出", () => {
    const s = createGestureState();
    feedWheel(s, 200, 0);
    expect(feedWheel(s, 200, 0)).toBeNull(); // 冷却期内
    const r = feedWheel(s, 200, 1000);
    expect(r).toEqual({ direction: -1 });
  });

  it("阈值内不产出", () => {
    const s = createGestureState();
    expect(feedWheel(s, 10, 0)).toBeNull();
    expect(feedWheel(s, 5, 5)).toBeNull();
  });

  it("触控板高频小 delta 被吸收（累计阈值）", () => {
    const s = createGestureState();
    for (let i = 0; i < 5; i++) {
      expect(feedWheel(s, 8, i)).toBeNull();
    }
  });

  it("向上滚轮（deltaY 负）产出方向 +1", () => {
    const s = createGestureState();
    const r = feedWheel(s, -300, 1000);
    expect(r).toEqual({ direction: 1 });
  });
});

describe("feedTouch", () => {
  it("向上滑动（dy 负）位移超阈值 → 下一站 -1", () => {
    const s = createGestureState();
    const r = feedTouch(s, { y: 200 }, { y: 0 }, 0);
    expect(r).toEqual({ direction: -1 });
  });

  it("向下滑动（dy 正）→ 上一站 +1", () => {
    const s = createGestureState();
    const r = feedTouch(s, { y: 0 }, { y: 200 }, 0);
    expect(r).toEqual({ direction: 1 });
  });

  it("位移阈值内不产出", () => {
    const s = createGestureState();
    expect(feedTouch(s, { y: 0 }, { y: 30 }, 0)).toBeNull();
  });
});

describe("nextIndex 钳制", () => {
  it("首站向上滚钳制在 0", () => {
    expect(nextIndex(0, 1, 8)).toBe(0);
  });
  it("末站向下滚钳制在 count-1", () => {
    expect(nextIndex(7, -1, 8)).toBe(7);
  });
  it("常规前进一屏", () => {
    expect(nextIndex(2, -1, 8)).toBe(3);
    expect(nextIndex(2, 1, 8)).toBe(1);
  });
});

describe("resolveFlowBoundary（free 模式回收为 deck 的判定）", () => {
  it("deck 模式恒保持 deck（进 free 由 hook 在素材站下滚越界时发起）", () => {
    expect(resolveFlowBoundary("deck", 0, -1)).toBe("deck");
    expect(resolveFlowBoundary("deck", 0, 1)).toBe("deck");
  });
  it("free 顶部上滚 → deck", () => {
    expect(resolveFlowBoundary("free", 0, 1)).toBe("deck");
  });
  it("free 顶部附近死区（>2px 内）上滚 → deck", () => {
    expect(resolveFlowBoundary("free", 1, 1)).toBe("deck");
  });
  it("free 非顶部上滚保持 free", () => {
    expect(resolveFlowBoundary("free", 300, 1)).toBe("free");
  });
  it("free 下滚保持 free", () => {
    expect(resolveFlowBoundary("free", 100, -1)).toBe("free");
  });
  it("free 顶部下滚保持 free（素材区继续向下浏览）", () => {
    expect(resolveFlowBoundary("free", 0, -1)).toBe("free");
  });
});

describe("easeInOutCubic", () => {
  it("端点与中点", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });
});