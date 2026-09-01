/**
 * 日历横向拖拽翻月纯函数（无 DOM、可单测）。dx 为指针横向位移累计（px）。
 * 返回约定：左拖超阈值 → 下月 1，右拖 → 上月 -1，未超阈值 → 0。
 */

export interface DragState {
  dx: number;
}

/** 拖拽翻月阈值（px），注入可调。 */
export const DRAG_THRESHOLD = 60;

export function createDrag(): DragState {
  return { dx: 0 };
}

/** 累计一次横向位移。 */
export function feedPointer(state: DragState, dx: number): void {
  state.dx += dx;
}

/** 松开：超阈值返回方向，否则 0；随后归零可复用。 */
export function release(state: DragState, threshold: number = DRAG_THRESHOLD): -1 | 0 | 1 {
  if (state.dx <= -threshold) {
    state.dx = 0;
    return 1;
  }
  if (state.dx >= threshold) {
    state.dx = 0;
    return -1;
  }
  state.dx = 0;
  return 0;
}