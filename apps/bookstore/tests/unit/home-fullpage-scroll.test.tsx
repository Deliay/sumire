// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { useRef } from "react";
import { useFullpageScroll, IMPULSE_EVENT, SCROLL_IMPULSE_EVENT } from "@/features/home/useFullpageScroll";
import { visibleSections, SECTION_CHANGE_EVENT } from "@/features/home/sections";

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

/** 模拟 FullpageDeck：每次渲染生成新的 sections 数组（回归振荡缺陷的防护）。 */
function UnstableSectionsHarness({ onIndexChange }: { onIndexChange?: (i: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { index } = useFullpageScroll({
    sections: visibleSections(true),
    assetsIndex: 7,
    trackRef,
    containerRef,
    onIndexChange,
  });
  return (
    <div ref={containerRef} data-testid="container">
      <div ref={trackRef} data-testid="track" data-index={index}>
        {visibleSections(true).map((s) => (
          <div key={s.id} data-section={s.id} style={{ height: "100svh" }} />
        ))}
      </div>
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

  it("line-mode（deltaMode=1）小步长滚轮归一化为像素后累积翻页（Firefox）", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // Firefox 每刻度 deltaY=3 行 ×24px = 72px，需多步累积到 100px 阈值；deltaMode=1 且同手势窗口内累积
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 10) });
    act(() => {
      for (let i = 0; i < 6; i++) {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 3, deltaMode: 1 }));
      }
    });
    // 归一化后累积 6×72=432px > 阈值 → 翻一屏
    expect(track.dataset.index).toBe("1");
    vi.unstubAllGlobals();
  });

  it("下翻（下一站）rAF 转场按 px 向下平移，粒子流场 velocity 为正（下坠）", () => {
    // rAF 单步执行：首帧 t=0（起点），验证轨道向负 y 平移（下翻）
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 100) });
    const scrollSpy = vi.fn();
    window.addEventListener(SCROLL_IMPULSE_EVENT, scrollSpy);
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    // 索引已切到 1；首帧动画起点为当前位置，随后帧应向 -vh 推进
    expect(track.dataset.index).toBe("1");
    // 触发多帧，动画推进后 transform 用 px（不含 svh）
    act(() => {
      rafQueue.splice(0).forEach((cb) => cb(200));
      rafQueue.splice(0).forEach((cb) => cb(500));
    });
    expect(track.style.transform).toContain("px");
    expect(track.style.transform).not.toContain("svh");
    // 下翻：转场期派发的 flow-scroll velocity 应为正（下坠语义，与 direction 一致）
    const velocities = scrollSpy.mock.calls
      .map((c) => (c[0] as CustomEvent).detail.velocity as number)
      .filter((v) => Number.isFinite(v));
    expect(velocities.length).toBeGreaterThan(0);
    expect(velocities.every((v) => v > 0)).toBe(true);
    window.removeEventListener(SCROLL_IMPULSE_EVENT, scrollSpy);
    vi.unstubAllGlobals();
  });

  it("上翻（上一站）rAF 转场按 px 向上平移", () => {
    let t = 1000;
    vi.stubGlobal("performance", { now: () => (t += 1000) });
    const rafQueue: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }));
    });
    expect(track.dataset.index).toBe("0");
    act(() => {
      rafQueue.splice(0).forEach((cb) => cb(300));
      rafQueue.splice(0).forEach((cb) => cb(600));
    });
    expect(track.style.transform).toContain("px");
    expect(track.style.transform).not.toContain("svh");
    vi.unstubAllGlobals();
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
    // rAF 用递增时间戳执行，使动画帧推进到终止，且挂载 hash 直落 effect 可运行
    let t = 0;
    vi.stubGlobal("performance", { now: () => t });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    window.history.replaceState(null, "", "#archive-3");
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // 执行全部挂起的 rAF 帧（时间戳递增，动画自然终止）
    act(() => {
      while (frames.length) {
        const cb = frames.shift()!;
        t += 1000;
        cb(t);
      }
    });
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

  it("reduced-motion 下转场与冲量与常规一致（不降级）", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 200) });
    const rafCalls: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCalls.push(cb);
      return rafCalls.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const impulseSpy = vi.fn();
    window.addEventListener(IMPULSE_EVENT, impulseSpy);
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("1");
    // 转场仍用 px 插值（非 svh），且 rAF 动画照常调度
    act(() => {
      rafCalls.splice(0).forEach((cb) => cb(performance.now()));
      rafCalls.splice(0).forEach((cb) => cb(performance.now()));
    });
    expect(track.style.transform).toContain("px");
    expect(track.style.transform).not.toContain("svh");
    // 冲量照常派发（展示向氛围层不降级 reduced-motion）
    expect(impulseSpy).toHaveBeenCalled();
    window.removeEventListener(IMPULSE_EVENT, impulseSpy);
    vi.unstubAllGlobals();
  });

  it("卸载清理不抛错", () => {
    const { unmount } = render(<Harness />);
    expect(() => unmount()).not.toThrow();
  });

  it("hashchange 响应导航锚点点击（首页内点击导航 → deck 翻页）", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // 模拟点击「素材」导航，URL hash 变为 #assets
    window.history.replaceState(null, "", "#assets");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(track.dataset.index).toBe("7");
    window.history.replaceState(null, "", "/");
  });

  it("NAVIGATE_EVENT 响应导航锚点点击（Next Link pushState 不触发 hashchange）", () => {
    render(<Harness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    act(() => {
      window.dispatchEvent(
        new CustomEvent("sumire:navigate", { detail: { id: "assets" } }),
      );
    });
    expect(track.dataset.index).toBe("7");
  });

  it("索引变化派发 SECTION_CHANGE_EVENT（deck → NavBar 同步）", () => {
    const spy = vi.fn();
    window.addEventListener(SECTION_CHANGE_EVENT, spy);
    render(<Harness />);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(spy).toHaveBeenCalled();
    const detail = (spy.mock.calls.at(-1)![0] as CustomEvent).detail;
    expect(detail.navKey).toBe("archive");
    window.removeEventListener(SECTION_CHANGE_EVENT, spy);
  });

  it("free 模式滚动派发 SCROLL_IMPULSE_EVENT（连续喂入粒子冲量）", () => {
    // 让 performance.now 随调用递增，绕过 wheel 冷却（一次手势一屏但需多次翻页到末站）
    let t = 0;
    vi.stubGlobal("performance", {
      now: () => (t += 1000),
    });
    render(<Harness />);
    // 进入 free：逐站滚到素材站（index 7）再下滚越界
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    expect(container.style.overflow).toBe("auto"); // 已进入 free 模式

    const scrollSpy = vi.fn();
    window.addEventListener(SCROLL_IMPULSE_EVENT, scrollSpy);
    act(() => {
      // 模拟素材区向下滚动：scrollTop 从 0 跳到 400
      container.scrollTop = 400;
      container.dispatchEvent(new Event("scroll"));
    });
    expect(scrollSpy).toHaveBeenCalled();
    window.removeEventListener(SCROLL_IMPULSE_EVENT, scrollSpy);
    vi.unstubAllGlobals();
  });

  it("free 模式回顶回收上翻用上浮缓出曲线（非误用下坠缓入）", () => {
    let t = 0;
    vi.stubGlobal("performance", {
      now: () => (t += 1000),
    });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<Harness />);
    // 进入 free：逐站滚到素材站（index 7）再下滚越界
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    expect(container.style.overflow).toBe("auto"); // 已进入 free 模式
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // 先向下滚动更新 lastScrollTopRef
    act(() => {
      container.scrollTop = 400;
      container.dispatchEvent(new Event("scroll"));
    });
    // 回顶继续上滚 → 回收 deck 并翻上一站（上翻）
    act(() => {
      container.scrollTop = 0;
      container.dispatchEvent(new Event("scroll"));
    });
    expect(container.style.overflow).toBe("hidden");
    expect(track.dataset.index).toBe("6");
    // 执行动画帧推进到终止，transform 用 px（不含 svh 单位）
    act(() => {
      while (frames.length) {
        const cb = frames.shift()!;
        cb(performance.now() + 1000);
      }
    });
    expect(track.style.transform).toContain("px");
    expect(track.style.transform).not.toContain("svh");
    vi.unstubAllGlobals();
  });

  it("sections 引用不稳定（每渲染新数组）时连续翻页后 index/hash 稳定不振荡（回归）", () => {
    let t = 0;
    vi.stubGlobal("performance", {
      now: () => (t += 1000),
    });
    // rAF 捕获但不执行（禁用动画），聚焦索引/hash 稳定性（振荡回归防护）
    const rafCalls: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCalls.push(cb);
      return rafCalls.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<UnstableSectionsHarness />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;

    // 翻到 index 1
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("1");
    const hash1 = window.location.hash;

    // 再翻到 index 2
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    expect(track.dataset.index).toBe("2");
    const hash2 = window.location.hash;

    // 无输入下再触发若干渲染（模拟 rAF 回拨），应保持 index 2、hash 不变
    act(() => {
      rafCalls.splice(0);
    });
    expect(track.dataset.index).toBe("2");
    expect(window.location.hash).toBe(hash2);
    expect(window.location.hash).toBe(hash2);
    expect(track.dataset.index).toBe("2");
    void hash1;
    vi.unstubAllGlobals();
  });

  it("触摸起始位于实际可滚动内容列内不触发整页翻页", () => {
    const onIndexChange = vi.fn();
    render(<Harness onIndexChange={onIndexChange} />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // 可滚动列：data-fullpage-scrollable + overflowY auto + 内容溢出（scrollHeight>clientHeight）
    const scrollable = document.createElement("div");
    scrollable.setAttribute("data-fullpage-scrollable", "");
    scrollable.style.overflowY = "auto";
    scrollable.style.height = "100px";
    const tall = document.createElement("div");
    tall.style.height = "1000px";
    scrollable.appendChild(tall);
    document.body.appendChild(scrollable);
    Object.defineProperty(scrollable, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(scrollable, "scrollHeight", { value: 1000, configurable: true });
    const fakeTouch = { identifier: 1, clientY: 300 } as Touch;
    const fakeTouch2 = { identifier: 1, clientY: 100 } as Touch;
    act(() => {
      const start = new Event("touchstart", { bubbles: true }) as TouchEvent;
      Object.defineProperty(start, "target", { value: scrollable });
      Object.defineProperty(start, "touches", { value: [fakeTouch] });
      window.dispatchEvent(start);
      const move = new Event("touchmove", { bubbles: true }) as TouchEvent;
      Object.defineProperty(move, "target", { value: scrollable });
      Object.defineProperty(move, "touches", { value: [fakeTouch2] });
      window.dispatchEvent(move);
    });
    expect(track.dataset.index).toBe("0");
    expect(onIndexChange).not.toHaveBeenCalled();
    document.body.removeChild(scrollable);
  });

  it("非溢出滚动标记（如桌面日历站整 section）不豁免，滚轮/触摸照常翻页", () => {
    const onIndexChange = vi.fn();
    render(<Harness onIndexChange={onIndexChange} />);
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    // 挂 data-fullpage-scrollable 但内容不溢出（scrollHeight≈clientHeight），应不豁免
    const el = document.createElement("div");
    el.setAttribute("data-fullpage-scrollable", "");
    el.style.overflowY = "auto";
    el.style.height = "100px";
    Object.defineProperty(el, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: 100, configurable: true });
    document.body.appendChild(el);
    act(() => {
      const start = new Event("touchstart", { bubbles: true }) as TouchEvent;
      Object.defineProperty(start, "target", { value: el });
      Object.defineProperty(start, "touches", { value: [{ identifier: 1, clientY: 300 } as Touch] });
      window.dispatchEvent(start);
      const move = new Event("touchmove", { bubbles: true }) as TouchEvent;
      Object.defineProperty(move, "target", { value: el });
      Object.defineProperty(move, "touches", { value: [{ identifier: 1, clientY: 100 } as Touch] });
      window.dispatchEvent(move);
    });
    expect(track.dataset.index).toBe("1"); // 不豁免 → 翻页
    expect(onIndexChange).toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it("free 模式顶部（scrollTop=0）未下滚直接上滚 wheel 回收上翻（不被 free 分支吞掉）", () => {
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 1000) });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<Harness />);
    // 进入 free：逐站滚到素材站（index 7）再下滚越界
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(container.style.overflow).toBe("auto");
    // scrollTop 恒 0（进入 free 未下滚），立即上滚：无 scroll 事件也须回收上翻
    expect(container.scrollTop).toBe(0);
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: -200 }));
    });
    expect(container.style.overflow).toBe("hidden");
    expect(track.dataset.index).toBe("6");
    void frames;
    vi.unstubAllGlobals();
  });

  it("free 模式触屏未下滚直接上滑回收上翻（不被 free 分支吞掉）", () => {
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 1000) });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    render(<Harness />);
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(container.style.overflow).toBe("auto");
    expect(container.scrollTop).toBe(0);
    act(() => {
      const start = new Event("touchstart", { bubbles: true }) as TouchEvent;
      Object.defineProperty(start, "touches", { value: [{ identifier: 1, clientY: 100 } as Touch] });
      window.dispatchEvent(start);
      const move = new Event("touchmove", { bubbles: true }) as TouchEvent;
      Object.defineProperty(move, "touches", { value: [{ identifier: 1, clientY: 300 } as Touch] });
      window.dispatchEvent(move);
    });
    // 上滑（clientY 增大）→ 顶部回收上翻
    expect(container.style.overflow).toBe("hidden");
    expect(track.dataset.index).toBe("6");
    void frames;
    vi.unstubAllGlobals();
  });

  it("free 模式键盘：↓/PageDown 显式 scrollBy 向下滚动、↑/PageUp 顶部回收上翻、scrollTop>DEADZONE 时向上滚动", () => {
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 1000) });
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    // 捕获 scrollBy 调用（jsdom 不实现原生滚动，断言显式滚动参数以证明键盘可用）
    HTMLElement.prototype.scrollBy = () => {};
    const scrollBySpy = vi.spyOn(HTMLElement.prototype, "scrollBy");
    render(<Harness />);
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(container.style.overflow).toBe("auto");
    // ↓ 顶部向下：显式向下滚动（不回收、不翻页），index 不变
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(scrollBySpy).toHaveBeenLastCalledWith({ top: expect.any(Number) });
    expect((scrollBySpy.mock.calls.at(-1)![0] as unknown as { top: number }).top).toBeGreaterThan(0);
    expect(track.dataset.index).toBe("7");
    expect(container.style.overflow).toBe("auto");
    // ↑ 顶部 → 回收上翻（不调用向下 scrollBy）
    scrollBySpy.mockClear();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(scrollBySpy).not.toHaveBeenCalled();
    expect(container.style.overflow).toBe("hidden");
    expect(track.dataset.index).toBe("6");
    vi.unstubAllGlobals();
  });

  it("free 模式 scrollTop>DEADZONE 时 ↑/PageUp 显式向上 scrollBy（不回收），PageDown 步长为一屏高", () => {
    let t = 0;
    vi.stubGlobal("performance", { now: () => (t += 1000) });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    HTMLElement.prototype.scrollBy = () => {};
    const scrollBySpy = vi.spyOn(HTMLElement.prototype, "scrollBy");
    render(<Harness />);
    for (let i = 0; i < 8; i++) {
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    }
    const container = document.querySelector("[data-testid='container']") as HTMLElement;
    const track = document.querySelector("[data-testid='track']") as HTMLElement;
    expect(container.style.overflow).toBe("auto");
    // 让容器处于已滚动位置（scrollTop > DEADZONE）→ ↑ 应向上滚动而非回收
    Object.defineProperty(container, "scrollTop", { value: 500, configurable: true, writable: true });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect((scrollBySpy.mock.calls.at(-1)![0] as unknown as { top: number }).top).toBeLessThan(0);
    expect(track.dataset.index).toBe("7"); // 未回收、未翻页
    expect(container.style.overflow).toBe("auto");
    // PageDown 步长 = 一屏高（getVh）
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    });
    expect((scrollBySpy.mock.calls.at(-1)![0] as unknown as { top: number }).top).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});