import type { LiveEvent } from "./types";

/**
 * 弹幕重复折叠纯函数。仅作用于 danmaku 类型；其余类型原样透传（count=1）。
 *
 * 折叠规则（对可视列表内的重复弹幕，不区分是否相邻）：
 * - 表情弹幕：以 emote url 为键，重复（4.1 表情）折叠；
 * - 文字弹幕：以「最长非重复子串」为键，「妈妈妈妈妈」「妈妈妈」「妈妈」均取「妈」而折叠（4.2）；
 *   完全相同的文字也因最长非重复子串相同而折叠（4.1 文字）。
 *
 * 全列表内按折叠键去重：同一键的重复弹幕折叠到首次出现位置并累计计数，可跨其他事件。
 * 折叠后可视行数减少，由调用方（FeedSection）向下加载一条填充。
 */

/** 求字符串的最长无重复字符子串（返回该子串本身）。 */
export function longestNonRepeatSubstring(s: string): string {
  let start = 0;
  let bestStart = 0;
  let bestLen = 0;
  const seen = new Map<string, number>();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (seen.has(ch) && seen.get(ch)! >= start) {
      start = seen.get(ch)! + 1;
    }
    seen.set(ch, i);
    const len = i - start + 1;
    if (len > bestLen) {
      bestLen = len;
      bestStart = start;
    }
  }
  return s.slice(bestStart, bestStart + bestLen);
}

/** 弹幕折叠键：表情弹幕以 url 为键，文字弹幕以最长非重复子串为键；非弹幕返回 null。 */
export function danmakuMergeKey(event: LiveEvent): string | null {
  if (event.type !== "danmaku") return null;
  if (event.emote?.url) return `emote:${event.emote.url}`;
  if (event.content !== undefined) return `text:${longestNonRepeatSubstring(event.content)}`;
  return null;
}

/** 折叠后的展示行：代表事件 + 重复次数。 */
export interface MergedDanmaku {
  event: LiveEvent;
  /** 折叠到该行的弹幕条数（≥1；>1 时展示计数）。 */
  count: number;
}

/** 将事件列表中的重复弹幕折叠为一行（按折叠键全列表去重，保留首次出现位置）。 */
export function mergeDanmaku(events: LiveEvent[]): MergedDanmaku[] {
  const rows: MergedDanmaku[] = [];
  const byKey = new Map<string, MergedDanmaku>();
  for (const event of events) {
    const key = danmakuMergeKey(event);
    if (key !== null) {
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const row: MergedDanmaku = { event, count: 1 };
      byKey.set(key, row);
      rows.push(row);
    } else {
      rows.push({ event, count: 1 });
    }
  }
  return rows;
}
