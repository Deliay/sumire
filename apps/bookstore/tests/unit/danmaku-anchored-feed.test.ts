// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  ANCHOR_THRESHOLD,
  BACK_TO_TOP_THRESHOLD,
  computeAnchorScrollTop,
  useAnchoredFeed,
} from "@/features/danmaku/useAnchoredFeed";

describe("computeAnchorScrollTop prepend 锚定补偿", () => {
  it("贴顶（scrollTop <= 阈值）时不补偿，保持跟随最新", () => {
    expect(computeAnchorScrollTop(0, 1000, 1400)).toBeNull();
    expect(computeAnchorScrollTop(ANCHOR_THRESHOLD, 1000, 1400)).toBeNull();
  });

  it("离开顶部且容器变高时按 scrollHeight 差补偿", () => {
    expect(computeAnchorScrollTop(300, 1000, 1400)).toBe(700);
  });

  it("容器未变高或变矮时不补偿", () => {
    expect(computeAnchorScrollTop(300, 1000, 1000)).toBeNull();
    expect(computeAnchorScrollTop(300, 1400, 1000)).toBeNull();
  });
});

type FakeScroller = HTMLDivElement & { scrollTop: number; scrollHeight: number };

function makeScrollable(scrollTop: number, scrollHeight: number): FakeScroller {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollTop", { value: scrollTop, writable: true });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, writable: true });
  el.scrollTo = vi.fn();
  return el as FakeScroller;
}

describe("useAnchoredFeed", () => {
  it("离开顶部时新事件 prepend 后按高度差补偿 scrollTop（位置不跳）", () => {
    const { result, rerender } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 1000);
    act(() => {
      result.current.containerRef.current = el;
    });
    // 首次记录基线高度
    rerender();

    el.scrollTop = 300;
    el.scrollHeight = 1400;
    rerender();
    expect(el.scrollTop).toBe(700);
  });

  it("贴顶时新事件 prepend 后保持贴顶跟随", () => {
    const { result, rerender } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 1000);
    act(() => {
      result.current.containerRef.current = el;
    });
    rerender();

    el.scrollTop = 0;
    el.scrollHeight = 1400;
    rerender();
    expect(el.scrollTop).toBe(0);
  });

  it("prepend 估算补偿后，新行实测回填回缩时回退多补的部分", () => {
    const { result, rerender } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 1000);
    act(() => {
      result.current.containerRef.current = el;
    });
    rerender(); // 基线 1000

    // prepend：新行无实测缓存，先按估算高度 +72 补偿
    el.scrollTop = 300;
    el.scrollHeight = 1072;
    rerender();
    expect(el.scrollTop).toBe(372);

    // 新行实测回填（实际 29.2px）：总高回缩 42.8，回退多补的部分
    el.scrollHeight = 1029.2;
    rerender();
    expect(el.scrollTop).toBeCloseTo(329.2, 5);
  });

  it("补偿与实测回填之间夹带 diff=0 的中间渲染（如 isScrolling）不影响回退", () => {
    const { result, rerender } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 1000);
    act(() => {
      result.current.containerRef.current = el;
    });
    rerender(); // 基线 1000

    el.scrollTop = 300;
    el.scrollHeight = 1072;
    rerender();
    expect(el.scrollTop).toBe(372);

    // 补偿改写 scrollTop 触发的 isScrolling 中间渲染：高度未变
    rerender();
    expect(el.scrollTop).toBe(372);

    // 实测回填回缩仍需回退
    el.scrollHeight = 1029.2;
    rerender();
    expect(el.scrollTop).toBeCloseTo(329.2, 5);
  });

  it("无前置 prepend 补偿的高度回缩不调整（滚动加载实测回填场景）", () => {
    const { result, rerender } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 1000);
    act(() => {
      result.current.containerRef.current = el;
    });
    rerender(); // 基线 1000

    // 滚动中新渲染条目实测小于估算：总高回缩，不得补偿（避免滚动中视口跳动）
    el.scrollTop = 300;
    el.scrollHeight = 950;
    rerender();
    expect(el.scrollTop).toBe(300);
  });

  it("scrollTop > 200 时显示回到顶部，scrollToTop 回滚到顶", () => {
    const { result } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 2000);
    act(() => {
      result.current.containerRef.current = el;
    });
    expect(result.current.showBackToTop).toBe(false);

    act(() => {
      el.scrollTop = BACK_TO_TOP_THRESHOLD + 1;
      result.current.handleScroll();
    });
    expect(result.current.showBackToTop).toBe(true);

    act(() => {
      result.current.scrollToTop();
    });
    expect(el.scrollTo).toHaveBeenCalledWith({ top: 0 });

    act(() => {
      el.scrollTop = 0;
      result.current.handleScroll();
    });
    expect(result.current.showBackToTop).toBe(false);
  });

  it("isAtTop：初始贴顶，滚动离开后 false，回到顶部后恢复 true", () => {
    const { result } = renderHook(() => useAnchoredFeed());
    const el = makeScrollable(0, 2000);
    act(() => {
      result.current.containerRef.current = el;
    });
    expect(result.current.isAtTop).toBe(true);

    act(() => {
      el.scrollTop = ANCHOR_THRESHOLD + 1;
      result.current.handleScroll();
    });
    expect(result.current.isAtTop).toBe(false);

    act(() => {
      el.scrollTop = ANCHOR_THRESHOLD;
      result.current.handleScroll();
    });
    expect(result.current.isAtTop).toBe(true);
  });
});
