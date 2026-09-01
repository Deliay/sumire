// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import GlowParticles from "@/features/home/GlowParticles";
import { stepParticles } from "@/features/home/glowParticles";

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
    set: (next: boolean) => {
      mql.matches = next;
      listener?.({ matches: next });
    },
  };
}

/** rAF 打桩：支持 cancelAnimationFrame 移除回调。 */
function mockRaf() {
  const map = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextId++;
    map.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    map.delete(id);
  });
  return {
    pending: () => map.size,
    run: (n: number) => {
      for (let i = 0; i < n; i++) {
        const entries = [...map.entries()];
        map.clear();
        for (const [, cb] of entries) cb(performance.now());
      }
    },
  };
}

/** Canvas 2D context 打桩。 */
function mockCanvas() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillStyle: "",
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    canvas: { width: 0, height: 0 },
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return ctx;
}

let raf: ReturnType<typeof mockRaf>;
let mq: ReturnType<typeof makeMatchMedia>;

beforeEach(() => {
  raf = mockRaf();
  mq = makeMatchMedia(false);
  vi.stubGlobal("matchMedia", mq.stub);
  mockCanvas();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GlowParticles", () => {
  it("普通环境渲染 canvas[aria-hidden] 且 pointer-events-none，卸载不抛错", () => {
    const { unmount } = render(<GlowParticles />);
    const canvas = document.querySelector('[data-testid="glow-particles"]');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect((canvas as HTMLElement).className).toContain("pointer-events-none");
    raf.run(1);
    expect(() => unmount()).not.toThrow();
  });

  it("reduced-motion 时仍为常规档（不降级：全上限、明灭开启、全速）", () => {
    mq.set(true);
    const stepSpy = vi.fn(stepParticles);
    const capSpy = vi.fn(() => 20);
    render(<GlowParticles step={stepSpy} cap={capSpy} />);
    expect(document.querySelector('[data-testid="glow-particles"]')).toBeTruthy();
    raf.run(1);
    expect(stepSpy).toHaveBeenCalled();
    const last = stepSpy.mock.calls.at(-1)!;
    const particlesArg = last[0] as { length: number };
    const optsArg = last[2] as { speed: number; flicker: boolean };
    expect(particlesArg.length).toBe(20); // 全上限（不减半）
    expect(optsArg.flicker).toBe(true);
    expect(optsArg.speed).toBe(1);
  });

  it("普通环境传入 step 的为常规档（明灭开启、全上限）", () => {
    const stepSpy = vi.fn(stepParticles);
    const capSpy = vi.fn(() => 20);
    render(<GlowParticles step={stepSpy} cap={capSpy} />);
    raf.run(1);
    const last = stepSpy.mock.calls.at(-1)!;
    const particlesArg = last[0] as { length: number };
    const optsArg = last[2] as { speed: number; flicker: boolean };
    expect(particlesArg.length).toBe(20);
    expect(optsArg.flicker).toBe(true);
    expect(optsArg.speed).toBe(1);
  });

  it("切换媒体查询后参数保持常规（不降级）", () => {
    const stepSpy = vi.fn(stepParticles);
    const capSpy = vi.fn(() => 20);
    render(<GlowParticles step={stepSpy} cap={capSpy} />);
    raf.run(1);
    expect((stepSpy.mock.calls.at(-1)![2] as { flicker: boolean }).flicker).toBe(true);

    act(() => mq.set(true));
    raf.run(1);
    expect((stepSpy.mock.calls.at(-1)![2] as { flicker: boolean }).flicker).toBe(true);
    expect((stepSpy.mock.calls.at(-1)![0] as { length: number }).length).toBe(20);
    expect(document.querySelector('[data-testid="glow-particles"]')).toBeTruthy();
  });

  it("document.hidden 时暂停 rAF，回前台恢复", () => {
    render(<GlowParticles />);
    raf.run(1);
    expect(raf.pending()).toBe(1); // 已调度下一帧

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(raf.pending()).toBe(0); // stop 取消挂起帧

    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(raf.pending()).toBe(1); // 恢复
  });

  it("常驻 fixed 类（覆盖全部模块，脱离 overflow-hidden 容器）", () => {
    render(<GlowParticles />);
    const canvas = document.querySelector('[data-testid="glow-particles"]') as HTMLElement;
    expect(canvas.className).toContain("fixed");
    expect(canvas.className).toContain("inset-0");
  });

  it("接收冲量事件后传入 step 的 flow 非零，随后衰减归零", () => {
    const stepSpy = vi.fn(stepParticles);
    const capSpy = vi.fn(() => 20);
    render(<GlowParticles step={stepSpy} cap={capSpy} />);
    raf.run(1);
    // 派发向下冲量（direction -1）
    act(() => {
      window.dispatchEvent(
        new CustomEvent("sumire:flow-impulse", { detail: { direction: -1 } }),
      );
    });
    raf.run(1);
    const last = stepSpy.mock.calls.at(-1)!;
    const flowArg = last[3] as { vx: number; vy: number };
    expect(flowArg).toBeTruthy();
    expect(Math.abs(flowArg.vy)).toBeGreaterThan(0);
  });

  it("reduced-motion 时注入冲量事件后 flow 照常非零（不降级）", () => {
    mq.set(true);
    const stepSpy = vi.fn(stepParticles);
    const capSpy = vi.fn(() => 20);
    render(<GlowParticles step={stepSpy} cap={capSpy} />);
    raf.run(1);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("sumire:flow-impulse", { detail: { direction: -1 } }),
      );
    });
    raf.run(1);
    const last = stepSpy.mock.calls.at(-1)!;
    const flowArg = last[3] as { vx: number; vy: number };
    expect(Math.abs(flowArg.vy)).toBeGreaterThan(0);
  });
});