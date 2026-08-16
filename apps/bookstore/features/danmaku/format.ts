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

/**
 * 上船船型强调色（左竖条 / chip / 金额共用）：
 * 3=舰长 → 蓝（eye）；2=提督 → 紫（flower）；1=总督 → 红（crimson）。
 * 未知等级回退紫色。返回 Tailwind token 类名。
 */
export function guardLevelTone(level: number): { bar: string; chip: string; text: string } {
  switch (level) {
    case 3:
      return { bar: "bg-eye/70", chip: "bg-eye/25", text: "text-eye" };
    case 1:
      return { bar: "bg-crimson/70", chip: "bg-crimson/25", text: "text-crimson" };
    case 2:
    default:
      return { bar: "bg-flower/70", chip: "bg-flower/30", text: "text-flower" };
  }
}

/**
 * 礼物价值（元）强调色：<10 灰（ink-dim）；10-99 蓝（eye）；100-500 金（gold）；>500 红（crimson）。
 * 返回 Tailwind token 类名。
 */
export function giftPriceTone(price: number): string {
  if (price > 500) return "text-crimson";
  if (price >= 100) return "text-gold";
  if (price >= 10) return "text-eye";
  return "text-ink-dim";
}
