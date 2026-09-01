// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { useRef } from "react";
import { useFullpageScroll, IMPULSE_EVENT } from "@/features/home/useFullpageScroll";
import { visibleSections } from "@/features/home/sections";

const sections8 = visibleSections(true);

function mockMatchMedia(matches: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null;
  const mql = {
    matches,
    media: "",
    addEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  return {
    stub: () => mql,
    set: (next: boolean) => {
      mql.matches = next;
      listener?.({ matches: next });
    },
  };
}

function Harness({ onIndexChange }: { onIndexChange?: (i: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index, goTo } = useFullpageScroll({
    sections: sections8,
    assetsIndex: 7,
    trackRef,
    containerRef,
    onIndexChange,
  });
  return (
    <div ref={containerRef} data-testid="container">
      <div ref={trackRef} data-testid="track" data-index={index}>
        {sections8.map((s) => (
          <div key={s.id} data-section={s.id} style={{ height: "100svh" }} />
        ))}
      </div>
      <button onClick={() => goTo(3)}>goto3</button>
    </div>
  );
}

describe("useFullpageScroll", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("初始站 0、无 transform", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(track.dataset.index).toBe("0");
    expect(track.style.transform).toBe("");
  });

  it("wheel 序列翻页前进一屏且不连跳", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("1");
    // 冷却期内不连跳
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("1");
  });

  it("键盘 ArrowDown/ArrowUp 翻页", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(track.dataset.index).toBe("1");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(track.dataset.index).toBe("0");
  });

  it("hash 初始定位（#archive-3 直落）", () => {
    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("requestAnimationFrame", raf);
    window.history.replaceState(null, "", "#archive-3");
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(track.dataset.index).toBe("3");
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  });

  it("索引变化同步 hash replaceState", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(window.location.hash).toBe("#archive-1");
    void track;
  });

  it("goTo 跳转并触发 onIndexChange", () => {
    const cb = vi.fn();
    render(<Harness onIndexChange={cb} />);
    act(() => {
      (document.querySelector("button") as HTMLButtonElement).click();
    });
    expect(cb).toHaveBeenLastCalledWith(3);
  });

  it("reduced-motion 下转场参数降级且冲量事件不派发", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    const impulseSpy = vi.fn();
    window.addEventListener(IMPULSE_EVENT, impulseSpy);
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("1");
    expect(impulseSpy).not.toHaveBeenCalled();
    window.removeEventListener(IMPULSE_EVENT, impulseSpy);
  });

  it("卸载清理不抛错", () => {
    const { unmount } = render(<Harness />);
    expect(() => unmount()).not.toThrow();
  });
});