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
  const segments: HighlightSegment[] = [];
  let lastIndex = 0;
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  while (lastIndex < content.length) {
    const hitIndex = lowerContent.indexOf(lowerKeyword, lastIndex);
    if (hitIndex === -1) {
      segments.push({ text: content.slice(lastIndex), hit: false });
      break;
    }
    if (hitIndex > lastIndex) {
      segments.push({ text: content.slice(lastIndex, hitIndex), hit: false });
    }
    let end = hitIndex + keyword.length;
    while (end < content.length && lowerContent[end] === lowerKeyword[lowerKeyword.length - 1]) {
      const nextHit = lowerContent.indexOf(lowerKeyword, end);
      if (nextHit === end) {
        end += keyword.length;
      } else {
        break;
      }
    }
    segments.push({ text: content.slice(hitIndex, end), hit: true });
    lastIndex = end;
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
