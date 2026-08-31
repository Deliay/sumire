import { describe, it, expect } from "vitest";
import { lerp, pointerOffset, tiltOffset } from "@/features/home/parallax";

describe("pointerOffset", () => {
  it("中心无偏移", () => {
    expect(pointerOffset(400, 300, 800, 600, 12)).toEqual({ dx: 0, dy: 0 });
  });

  it("指针在右侧/下侧时取反（视差反向）偏移", () => {
    // 右边缘 → dx 为负（视差反向）
    expect(pointerOffset(800, 0, 800, 600, 12)).toEqual({ dx: -12, dy: 12 });
    // 左边缘 → dx 为正
    expect(pointerOffset(0, 0, 800, 600, 12)).toEqual({ dx: 12, dy: 12 });
    // 上边缘 → dy 为正
    expect(pointerOffset(0, 0, 800, 600, 12)).toEqual({ dx: 12, dy: 12 });
    // 下边缘 → dy 为负
    expect(pointerOffset(0, 600, 800, 600, 12)).toEqual({ dx: 12, dy: -12 });
  });

  it("幅度钳制不超 max", () => {
    const r = pointerOffset(0, 0, 800, 600, 10);
    expect(Math.abs(r.dx)).toBeLessThanOrEqual(10);
    expect(Math.abs(r.dy)).toBeLessThanOrEqual(10);
  });
});

describe("tiltOffset", () => {
  it("null/非法输入回零", () => {
    expect(tiltOffset(null, null, 12)).toEqual({ dx: 0, dy: 0 });
    expect(tiltOffset(undefined, 10, 12)).toEqual({ dx: 0, dy: 0 });
    expect(tiltOffset(NaN, NaN, 12)).toEqual({ dx: 0, dy: 0 });
  });

  it("gamma 映射水平、beta 映射垂直，超出 ±25° 钳制", () => {
    // gamma=25 → dx=max；gamma=-25 → dx=-max
    expect(tiltOffset(0, 25, 12)).toEqual({ dx: 12, dy: 0 });
    expect(tiltOffset(0, -25, 12)).toEqual({ dx: -12, dy: 0 });
    // 大幅倾斜钳制到 ±25（max 处）
    expect(tiltOffset(0, 90, 12)).toEqual({ dx: 12, dy: 0 });
    expect(tiltOffset(0, -180, 12)).toEqual({ dx: -12, dy: 0 });
    // beta 映射 dy
    expect(tiltOffset(25, 0, 12)).toEqual({ dx: 0, dy: 12 });
    expect(tiltOffset(-25, 0, 12)).toEqual({ dx: 0, dy: -12 });
  });

  it("钳制后归一化 × max 线性缩放", () => {
    // 12.5° → 0.5 * max
    expect(tiltOffset(12.5, 0, 12)).toEqual({ dx: 0, dy: 6 });
  });
});

describe("lerp", () => {
  it("t=0 返回 current，t=1 返回 target", () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it("t=0.5 为中间值", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it("收敛：多次迭代逼近 target", () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = lerp(v, 100, 0.5);
    expect(v).toBeCloseTo(100, 5);
  });
});