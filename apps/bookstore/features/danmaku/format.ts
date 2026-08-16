/** 弹幕后台展示换算纯函数。 */

import type { LiveEventType } from "./types";

const TYPE_LABELS: Record<LiveEventType, string> = {
  danmaku: "弹幕",
  super_chat: "SC",
  gift: "礼物",
  guard_buy: "上船",
};

/** 事件类型中文标签（栏标题用）。 */
export function labelForType(type: LiveEventType): string {
  return TYPE_LABELS[type];
}

/** guard_level → 船型名：3=舰长，2=提督，1=总督（契约口径）；未知等级返回 null，由调用方回退上游名称。 */
export function guardLevelName(level: number): string | null {
  if (level === 3) return "舰长";
  if (level === 2) return "提督";
  if (level === 1) return "总督";
  return null;
}

/** 金额（元）展示：整数不带小数，小数至多两位。 */
export function formatPrice(price: number): string {
  const rounded = Math.round(price * 100) / 100;
  return `¥${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}`;
}
