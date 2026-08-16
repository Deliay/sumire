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

function makeScrollable(scrollTop: number, scrollHeight: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollTop", { value: scrollTop, writable: true });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, writable: true });
  el.scrollTo = vi.fn();
  return el;
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
});
