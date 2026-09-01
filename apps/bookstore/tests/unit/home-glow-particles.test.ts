import { describe, it, expect } from "vitest";
import {
  createParticle,
  maxParticles,
  spawnPosition,
  stepParticles,
  createFlow,
  impulse,
  decayFlow,
  IMPULSE_CAP,
  type Particle,
  type StepOptions,
  type Flow,
} from "@/features/home/glowParticles";

const VW = { width: 500, height: 500 };

describe("spawnPosition", () => {
  it("无指针时全屏均匀（random 直接映射到视口）", () => {
    const p = spawnPosition(VW, null, 0.6, 160, () => 0.9);
    expect(p.x).toBeCloseTo(450);
    expect(p.y).toBeCloseTo(450);
  });

  it("指针存在且 random<bias 时命中指针附近半径内", () => {
    // random=0.1 < bias 0.6：偏置生成
    const p = spawnPosition(VW, { x: 100, y: 100 }, 0.6, 160, () => 0.1);
    const dx = p.x - 100;
    const dy = p.y - 100;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(160 + 1e-6);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(500);
  });

  it("指针存在但 random>=bias 时全屏均匀", () => {
    const p = spawnPosition(VW, { x: 100, y: 100 }, 0.6, 160, () => 0.9);
    expect(p.x).toBeCloseTo(450);
    expect(p.y).toBeCloseTo(450);
  });

  it("偏置命中越界时钳制到视口内", () => {
    // random=0.5：ang=PI 指向左侧，dist=80，x 越界钳制到 0
    const p = spawnPosition({ width: 100, height: 100 }, { x: 2, y: 2 }, 0.6, 160, () => 0.5);
    expect(p.x).toBe(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(100);
  });
});

describe("createParticle", () => {
  it("初速向上微漂、带生命周期/尺寸/色相槽位", () => {
    const p = createParticle({ x: 10, y: 20 }, () => 0.5);
    expect(p.x).toBe(10);
    expect(p.y).toBe(20);
    expect(p.vy).toBeLessThan(0); // 向上
    expect(p.maxLife).toBeGreaterThan(0);
    expect(p.size).toBeGreaterThan(0);
    expect(p.colorIndex).toBeGreaterThanOrEqual(0);
    expect(p.colorIndex).toBeLessThanOrEqual(2);
  });
});

function makeParticle(partial: Partial<Particle> = {}): Particle {
  return {
    x: 0,
    y: 0,
    vx: 60,
    vy: -60,
    size: 4,
    maxLife: 1,
    age: 0,
    colorIndex: 0,
    baseAlpha: 0.5,
    phase: 0,
    alpha: 0.5,
    ...partial,
  };
}

describe("stepParticles", () => {
  const opts: StepOptions = { speed: 1, flicker: true, dt: 1 / 60 };

  it("推进位移并按生命周期淘汰寿终粒子", () => {
    const next = stepParticles([makeParticle({ age: 0 }), makeParticle({ age: 0.9999 })], 1 / 60, opts);
    // 第二个 age 将 ≥1 被淘汰
    expect(next).toHaveLength(1);
    const alive = next[0]!;
    expect(alive.x).toBeCloseTo(1); // 60 * 1/60
    expect(alive.y).toBeCloseTo(-1);
    expect(alive.age).toBeCloseTo(1 / 60);
  });

  it("明灭模式下 alpha 随 age 变化", () => {
    const p = makeParticle({ maxLife: 10 });
    const s1 = stepParticles([p], 1, opts)[0]!;
    const s2 = stepParticles([{ ...p, phase: Math.PI }], 1, opts)[0]!;
    expect(s1.alpha).not.toBe(s2.alpha);
  });

  it("flicker 关闭 + 降速参数下 alpha 恒定且位移按 speed 缩放", () => {
    const slow = { ...opts, speed: 0.5, flicker: false };
    const p = makeParticle({ maxLife: 10 });
    const s1 = stepParticles([p], 1, slow)[0]!;
    const s2 = stepParticles([{ ...p, phase: Math.PI }], 1, slow)[0]!;
    expect(s1.alpha).toBe(s2.alpha); // 无明灭
    expect(s1.alpha).toBe(p.baseAlpha);
    expect(s1.x).toBeCloseTo(60 * 0.5 * 1); // 速度减半
  });
});

describe("maxParticles", () => {
  it("按面积收敛，桌面约 ≤70", () => {
    const desktop = maxParticles(1280 * 800);
    expect(desktop).toBeLessThanOrEqual(70);
    expect(desktop).toBeGreaterThan(20);
    const tiny = maxParticles(200 * 200);
    expect(tiny).toBeLessThan(desktop);
  });
});

describe("createFlow / impulse / decayFlow（冲量流场）", () => {
  it("createFlow 初始零速度", () => {
    const f = createFlow();
    expect(f.vx).toBe(0);
    expect(f.vy).toBe(0);
  });

  it("impulse 方向正确（-1 向下 / +1 向上）", () => {
    const down = impulse(createFlow(), -1, 100);
    expect(down.vy).toBeGreaterThan(0); // 向下滚 → 下坠感（vy 正）
    const up = impulse(createFlow(), 1, 100);
    expect(up.vy).toBeLessThan(0); // 向上滚 → 上浮感（vy 负）
  });

  it("impulse 强度钳制上限，连续注入不超限", () => {
    const once = impulse(createFlow(), -1, 99999);
    expect(Math.abs(once.vy)).toBeLessThanOrEqual(IMPULSE_CAP);
    // 连续注入多次
    let f = createFlow();
    for (let i = 0; i < 10; i++) f = impulse(f, -1, IMPULSE_CAP);
    expect(Math.abs(f.vy)).toBeLessThanOrEqual(IMPULSE_CAP);
  });

  it("decayFlow 单调衰减最终归零", () => {
    let f: Flow = { vx: 0, vy: 200 };
    let prev = Math.abs(f.vy);
    for (let i = 0; i < 500; i++) {
      f = decayFlow(f, 1 / 30, 0.5);
      const cur = Math.abs(f.vy);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
    expect(f.vy).toBe(0);
  });

  it("stepParticles 叠加 flow 后位移方向与 flow 一致", () => {
    const opts: StepOptions = { speed: 1, flicker: true, dt: 1 / 60 };
    const p = makeParticle({ vx: 0, vy: 0 });
    const flow: Flow = { vx: 0, vy: 600 }; // 强向下
    const next = stepParticles([p], 1 / 60, opts, flow)[0]!;
    expect(next.y).toBeGreaterThan(p.y);
  });

  it("flow 缺省时与现态输出一致（回归）", () => {
    const opts: StepOptions = { speed: 1, flicker: true, dt: 1 / 60 };
    const p = makeParticle({ vx: 60, vy: -60, maxLife: 10 });
    const noFlow = stepParticles([p], 1 / 60, opts)[0]!;
    const withFlowZero = stepParticles([p], 1 / 60, opts, { vx: 0, vy: 0 })[0]!;
    expect(withFlowZero.x).toBeCloseTo(noFlow.x);
    expect(withFlowZero.y).toBeCloseTo(noFlow.y);
  });
});