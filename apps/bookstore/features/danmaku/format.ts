/** 弹幕看板展示换算纯函数。 */

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
 * 上船船型强调色（左竖条 / chip / 金额共用 / 条目打底）：
 * 3=舰长 → 蓝（eye）；2=提督 → 紫（flower）；1=总督 → 红（crimson）。
 * 未知等级回退紫色。返回 Tailwind token 类名。
 */
export function guardLevelTone(level: number): { bar: string; chip: string; text: string; item: string } {
  switch (level) {
    case 3:
      return { bar: "bg-eye/70", chip: "bg-eye/25", text: "text-eye", item: "bg-eye/10" };
    case 1:
      return { bar: "bg-crimson/70", chip: "bg-crimson/25", text: "text-crimson", item: "bg-crimson/10" };
    case 2:
    default:
      return { bar: "bg-flower/70", chip: "bg-flower/30", text: "text-flower", item: "bg-flower/10" };
  }
}

/** 头像上船挂件（本地素材）：3=舰长 / 2=提督 / 1=总督；未知等级返回 null（不渲染）。 */
export function guardBadgeAsset(level: number): string | null {
  switch (level) {
    case 3:
      return "/assets/original/guard-badge-captain.png";
    case 2:
      return "/assets/original/guard-badge-admiral.png";
    case 1:
      return "/assets/original/guard-badge-governor.png";
    default:
      return null;
  }
}

/** 弹幕条目船型淡色背景：3→eye, 2→flower, 1→crimson, 其余 null。 */
export function guardDanmakuTint(level: number | null | undefined): string | null {
  switch (level) {
    case 3:
      return "bg-eye/10 rounded-md";
    case 2:
      return "bg-flower/10 rounded-md";
    case 1:
      return "bg-crimson/10 rounded-md";
    default:
      return null;
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
