/**
 * 立绘视差偏移纯函数（无 DOM、可单测）。
 * 鼠标指针 / 设备倾角 → 目标偏移，均在 [-max, max] 内。
 */

/** 倾角钳制上限（度），超出后取极值。 */
export const TILT_CLAMP = 25;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * 指针坐标归一化到 [-1, 1] 后取反（视差反向）并乘以幅度上限。
 * 鼠标靠近右/下时立绘向左上反向偏移，营造纵深。
 */
export function pointerOffset(
  x: number,
  y: number,
  w: number,
  h: number,
  max: number,
): { dx: number; dy: number } {
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  return { dx: -nx * max + 0, dy: -ny * max + 0 };
}

/**
 * 设备倾角映射水平/垂直偏移：gamma→dx、beta→dy；倾角钳制到 ±TILT_CLAMP 后归一化 × 幅度上限。
 * null / undefined / NaN 输入回零（静默降级）。
 */
export function tiltOffset(
  beta: number | null | undefined,
  gamma: number | null | undefined,
  max: number,
): { dx: number; dy: number } {
  if (beta == null || gamma == null || Number.isNaN(beta) || Number.isNaN(gamma)) {
    return { dx: 0, dy: 0 };
  }
  const dx = (clamp(gamma, -TILT_CLAMP, TILT_CLAMP) / TILT_CLAMP) * max;
  const dy = (clamp(beta, -TILT_CLAMP, TILT_CLAMP) / TILT_CLAMP) * max;
  return { dx, dy };
}

/** 帧间线性插值；t 钳制到 [0, 1]。 */
export function lerp(current: number, target: number, t: number): number {
  const k = clamp(t, 0, 1);
  return current + (target - current) * k;
}