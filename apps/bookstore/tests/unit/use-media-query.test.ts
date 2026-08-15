// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery } from "@/lib/useMediaQuery";

interface MockMql {
  matches: boolean;
  addEventListener(type: string, cb: (e: { matches: boolean }) => void): void;
  removeEventListener(type: string, cb: (e: { matches: boolean }) => void): void;
}

function makeMatchMedia(initial: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null;
  const mql: MockMql = {
    matches: initial,
    addEventListener: (_type, cb) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  return {
    stub: () => mql,
    fire: (matches: boolean) => {
      mql.matches = matches;
      listener?.({ matches });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("无 matchMedia 环境（SSR）固定返回 false", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(false);
  });

  it("初始值反映 matchMedia.matches", () => {
    const mq = makeMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(true);
  });

  it("change 事件驱动更新", () => {
    const mq = makeMatchMedia(false);
    vi.stubGlobal("matchMedia", mq.stub);
    const { result } = renderHook(() => useMediaQuery("(max-width: 639px)"));
    expect(result.current).toBe(false);
    act(() => mq.fire(true));
    expect(result.current).toBe(true);
    act(() => mq.fire(false));
    expect(result.current).toBe(false);
  });
});
