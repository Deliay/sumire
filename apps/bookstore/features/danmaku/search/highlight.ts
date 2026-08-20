/**
 * 关键词高亮工具：将内容按关键词切分为命中/未命中段。
 * 使用 indexOf 循环朴素子串切分（规避正则元字符），连续命中合并。
 */
export interface HighlightSegment {
  text: string;
  hit: boolean;
}

export function splitByKeyword(content: string, keyword: string): HighlightSegment[] {
  if (!keyword || !content) {
    return [{ text: content, hit: false }];
  }
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const segments: HighlightSegment[] = [];
  let lastEnd = 0;

  while (lastEnd < content.length) {
    const hitIndex = lowerContent.indexOf(lowerKeyword, lastEnd);
    if (hitIndex === -1) {
      segments.push({ text: content.slice(lastEnd), hit: false });
      break;
    }
    // 推进到下一个非关键词开头的位置
    let nextStart = hitIndex + keyword.length;
    while (nextStart < content.length && lowerContent.startsWith(lowerKeyword, nextStart)) {
      nextStart += keyword.length;
    }
    if (hitIndex > lastEnd) {
      segments.push({ text: content.slice(lastEnd, hitIndex), hit: false });
    }
    segments.push({ text: content.slice(hitIndex, nextStart), hit: true });
    lastEnd = nextStart;
  }

  if (segments.length === 0) {
    return [{ text: content, hit: false }];
  }
  return segments;
}

/** 格式化事件时间为本地化短格式（MM/DD HH:mm）。 */
export function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
