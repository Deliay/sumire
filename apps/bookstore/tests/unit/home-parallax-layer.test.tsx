// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, fireEvent, act } from "@testing-library/react";
import ParallaxLayer from "@/features/home/ParallaxLayer";

interface MockMql {
  matches: boolean;
  addEventListener(type: string, cb: (e: { matches: boolean }) => void): void;
  removeEventListener(type: string, cb: (e: { matches: boolean }) => void): void;
}

/** 可变 matchMedia 桩，可动态 set matches 触发 change 事件。 */
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
    set: (next: boolean) => {
      mql.matches = next;
      listener?.({ matches: next });
    },
  };
}

/** rAF 打桩：手动推进帧，返回收集到的回调数。 */
function mockRaf() {
  let queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    pending: () => queue.length,
    run: (n: number) => {
      for (let i = 0; i < n; i++) {
        const q = queue;
        queue = [];
        q.forEach((cb) => cb(performance.now()));
      }
    },
    runUntilSettled: (max = 500) => {
      let guard = 0;
      while (queue.length > 0 && guard < max) {
        const q = queue;
        queue = [];
        q.forEach((cb) => cb(performance.now()));
        guard++;
      }
    },
  };
}

/** 让 jsdom 报告支持 deviceorientation（模拟有传感器的非 iOS 平台）。 */
function enableSensor() {
  Object.defineProperty(window, "ondeviceorientation", {
    value: null,
    writable: true,
    configurable: true,
  });
  // 消除 iOS requestPermission 路径，走直接挂监听
  vi.stubGlobal("DeviceOrientationEvent", {});
}

function layerEl() {
  return document.querySelector('[data-testid="parallax-layer"]') as HTMLElement;
}

let raf: ReturnType<typeof mockRaf>;
let mq: ReturnType<typeof makeMatchMedia>;
let addSpy: ReturnType<typeof vi.spyOn>;
let removeSpy: ReturnType<typeof vi.spyOn>;

function countListeners(spy: ReturnType<typeof vi.spyOn>, type: string): number {
  return spy.mock.calls.filter((c: unknown[]) => c[0] === type).length;
}

beforeEach(() => {
  raf = mockRaf();
  mq = makeMatchMedia(false);
  vi.stubGlobal("matchMedia", mq.stub);
  addSpy = vi.spyOn(window, "addEventListener");
  removeSpy = vi.spyOn(window, "removeEventListener");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).ondeviceorientation;
});

describe("ParallaxLayer（useParallax）", () => {
  it("普通环境 pointermove 后 transform 更新，pointerleave 后回中", () => {
    enableSensor();
    render(
      <ParallaxLayer className="hero">
        <span />
      </ParallaxLayer>,
    );
    const el = layerEl();
    expect(el).toBeTruthy();
    // 初始不写 transform
    expect(el.style.transform).toBe("");

    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: window.innerHeight });
    raf.runUntilSettled();
    // 右下角 → 视差反向：translate3d 为负值量级 ≈ -PARALLAX_MAX
    expect(el.style.transform).toMatch(/translate3d\(-1[12]\./);

    // pointerleave → 回中（收敛后 transform 置 none）
    fireEvent.pointerLeave(window);
    raf.runUntilSettled();
    expect(el.style.transform).toBe("none");
  });

  it("reduced-motion 时仍响应鼠标但幅度约 1/3，且不挂 deviceorientation 监听", () => {
    enableSensor();
    mq.set(true); // 先 reduce 再挂载
    render(
      <ParallaxLayer className="hero">
        <span />
      </ParallaxLayer>,
    );
    const el = layerEl();
    expect(countListeners(addSpy, "deviceorientation")).toBe(0);

    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: window.innerHeight });
    raf.runUntilSettled();
    // 幅度降至约 1/3（12/3=4，收敛余量 ±0.05）
    expect(el.style.transform).toMatch(/translate3d\(-[34]\./);
  });

  it("运行时切换媒体查询后幅度参数与传感器监听即时切换", () => {
    enableSensor();
    const addsBefore = countListeners(addSpy, "deviceorientation");
    render(
      <ParallaxLayer className="hero">
        <span />
      </ParallaxLayer>,
    );
    // 普通环境已挂 deviceorientation
    expect(countListeners(addSpy, "deviceorientation")).toBe(addsBefore + 1);

    // 切到 reduce：effect 重跑，清理 sensor 且不再挂载
    act(() => mq.set(true));
    raf.runUntilSettled();
    expect(countListeners(removeSpy, "deviceorientation")).toBeGreaterThanOrEqual(1);
    expect(countListeners(addSpy, "deviceorientation")).toBe(addsBefore + 1); // 未新增

    const el = layerEl();
    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: window.innerHeight });
    raf.runUntilSettled();
    expect(el.style.transform).toMatch(/translate3d\(-[34]\./);
  });

  it("无 matchMedia 环境兜底不抛错，卸载清理不抛错", () => {
    enableSensor();
    vi.stubGlobal("matchMedia", undefined);
    const { unmount } = render(
      <ParallaxLayer className="hero">
        <span />
      </ParallaxLayer>,
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    raf.runUntilSettled();
    expect(() => unmount()).not.toThrow();
  });
});