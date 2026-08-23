/** 悬停胶囊栏纯函数：判断可悬停、提取金额、计算悬停时长、排序。 */

import type { LiveEvent } from "./types";

export type PillKind = "sc" | "guard";

export interface HoverPill {
  eventId: string;
  kind: PillKind;
  price: number;
  arrivedAt: number;
  expiresAt: number;
  event: LiveEvent;
}

export const SC_DEFAULT_SECONDS = 60;

/** 仅 super_chat / guard_buy 可悬停。 */
export function isHoverable(event: LiveEvent): boolean {
  return event.type === "super_chat" || event.type === "guard_buy";
}

/** 金额（元）：取 event.price，缺失返回 0。 */
export function pillPrice(event: LiveEvent): number {
  return typeof event.price === "number" ? event.price : 0;
}

/**
 * 悬停时长（秒）：
 * - super_chat：取 event.time（> 0），缺失/非法回退 SC_DEFAULT_SECONDS；
 * - guard_buy：按 guard.level 映射（3→60s 舰长，2→300s 提督，1→3600s 总督），缺/未知 → 60s。
 */
export function hoverDuration(event: LiveEvent): number {
  if (event.type === "super_chat") {
    const t = event.time;
    return typeof t === "number" && t > 0 ? t : SC_DEFAULT_SECONDS;
  }
  if (event.type === "guard_buy") {
    const level = event.sender.guardLevel;
    if (level === 3) return 60;
    if (level === 2) return 300;
    if (level === 1) return 3600;
    return 60;
  }
  return SC_DEFAULT_SECONDS;
}

/** 胶囊类型：super_chat → "sc"，其余 → "guard"。 */
export function pillKind(event: LiveEvent): PillKind {
  return event.type === "super_chat" ? "sc" : "guard";
}

/** 排序：金额降序，金额相同 arrivedAt 降序（新者优先）。 */
export function pillSort(a: HoverPill, b: HoverPill): number {
  if (b.price !== a.price) return b.price - a.price;
  return b.arrivedAt - a.arrivedAt;
}
