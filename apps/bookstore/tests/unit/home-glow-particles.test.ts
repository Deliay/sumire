import { describe, it, expect } from "vitest";
import {
  createParticle,
  maxParticles,
  spawnPosition,
  stepParticles,
  type Particle,
  type StepOptions,
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

describe("stepParticles", () => {
  const opts: StepOptions = { speed: 1, flicker: true, dt: 1 / 60 };

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

  it("reduced-motion 参数：速度降低、明灭关闭（alpha 恒定）", () => {
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