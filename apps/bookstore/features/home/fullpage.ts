/**
 * 整页滚动翻页纯函数（无 DOM、可单测）。注入 now 便于确定性测试。
 *
 * 方向约定：`-1` = 向后（向下滚 → 下一站），`+1` = 向前（向上滚 → 上一站）。
 */

export type Direction = 1 | -1;
export type FlowMode = "deck" | "free";

export interface GestureState {
  /** 当前累积位移（wheel 的 deltaY / touch 的纵向位移）。 */
  accum: number;
  /** 最近一次输入的时间戳。 */
  lastAt: number;
  /** 该手势是否已产出过方向意图（锁定，避免一次手势连跳）。 */
  fired: boolean;
  /** 冷却截止时间戳（产出后到该时刻不再产出）。 */
  cooldownUntil: number;
}

/** 手势间最大间隔（超过视为新手势，重置累积）。 */
export const GESTURE_TIMEOUT = 150;
/** wheel 累积翻页阈值（px）。低于单格滚轮（Chrome 约 53px、line-mode 归一化约 72px），保证慢速逐格一次翻一屏。 */
export const WHEEL_THRESHOLD = 48;
/** 手势结束兜底触发的最小累积位移（px）：低于此视为误触不翻页。 */
export const MIN_FIRE_DELTA = 24;
/** touch 纵向位移翻页阈值（px）。 */
export const TOUCH_THRESHOLD = 50;
/** 产出后的冷却时长（ms）。 */
export const COOLDOWN = 400;
/** free 模式顶部回收死区（px）。 */
export const BOUNDARY_DEADZONE = 2;

export function createGestureState(): GestureState {
  return { accum: 0, lastAt: -Infinity, fired: false, cooldownUntil: 0 };
}

/** DOM_DELTA_LINE 每行折算的像素值。 */
export const LINE_DELTA_PX = 24;
/** DOM_DELTA_PAGE 每页折算为视口高度比例。 */
export const PAGE_DELTA_FACTOR = 0.9;

/**
 * 将 wheel 事件 deltaY 按 deltaMode 归一化为像素（DOM_DELTA_PIXEL 原样、DOM_DELTA_LINE ×24、DOM_DELTA_PAGE ×0.9×视口高）。
 * 解决 Firefox 等 line-mode 浏览器（deltaY 约 3 行）累积不到像素阈值导致翻页失效的问题。
 */
export function normalizeDeltaY(deltaY: number, deltaMode: number, viewportHeight: number): number {
  if (deltaMode === 1) return deltaY * LINE_DELTA_PX;
  if (deltaMode === 2) return deltaY * PAGE_DELTA_FACTOR * viewportHeight;
  return deltaY;
}

/** 重置累积与锁定（新手势）。 */
function resetForNewGesture(s: GestureState, now: number): void {
  s.accum = 0;
  s.fired = false;
  s.lastAt = now;
}

/**
 * 喂入滚轮事件：同一次手势连续 delta 累加，超阈值且过冷却期只产出一个方向意图。
 * 手势间隔超过 GESTURE_TIMEOUT 视为新手势，重置累积。
 */
export interface WheelIntent {
  direction: Direction;
}

export function feedWheel(
  s: GestureState,
  deltaY: number,
  now: number,
): WheelIntent | null {
  if (now < s.cooldownUntil) return null;
  // 新手势：若上一手势累积了超过最小值的同向位移但未达阈值，兜底触发一次（慢速单格翻页）
  if (now - s.lastAt > GESTURE_TIMEOUT) {
    const pending = s.accum;
    resetForNewGesture(s, now);
    if (!s.fired && Math.abs(pending) >= MIN_FIRE_DELTA) {
      s.fired = true;
      s.cooldownUntil = now + COOLDOWN;
      const direction: Direction = pending > 0 ? -1 : 1;
      return { direction };
    }
  }
  s.accum += deltaY;
  s.lastAt = now;
  if (Math.abs(s.accum) < WHEEL_THRESHOLD) return null;
  if (s.fired) return null;
  s.fired = true;
  s.cooldownUntil = now + COOLDOWN;
  const direction: Direction = s.accum > 0 ? -1 : 1;
  s.accum = 0;
  return { direction };
}

/**
 * 喂入触控位移（start/current 纵向坐标）：位移阈值 + 速度下限。
 */
export function feedTouch(
  s: GestureState,
  start: { y: number },
  current: { y: number },
  now: number,
): WheelIntent | null {
  if (now < s.cooldownUntil) return null;
  if (now - s.lastAt > GESTURE_TIMEOUT) resetForNewGesture(s, now);
  const dy = current.y - start.y;
  s.accum = dy;
  s.lastAt = now;
  if (Math.abs(dy) < TOUCH_THRESHOLD) return null;
  if (s.fired) return null;
  s.fired = true;
  s.cooldownUntil = now + COOLDOWN;
  const direction: Direction = dy > 0 ? 1 : -1;
  s.accum = 0;
  return { direction };
}

/** 目标站索引钳制到 [0, count-1]。 */
export function nextIndex(current: number, direction: Direction, count: number): number {
  return Math.max(0, Math.min(count - 1, current + (direction === -1 ? 1 : -1)));
}

/**
 * 素材区 deck/free 边界判定：free 模式下顶部（含死区）且继续上滚 → 回收为 deck；
 * 其余保持当前模式。deck → free 的交接由调用方在素材站下滚越界时发起。
 */
export function resolveFlowBoundary(
  mode: FlowMode,
  scrollTop: number,
  direction: Direction,
): FlowMode {
  if (mode !== "free") return "deck";
  if (scrollTop <= BOUNDARY_DEADZONE && direction === 1) return "deck";
  return "free";
}

/** 缓入缓出三次贝塞尔近似（CSS easeInOutCubic 等价）。 */
export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}