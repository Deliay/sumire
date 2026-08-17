/** B 站视频 BV 号正则（匹配 BV 后跟 8 位以上字母数字）。 */
const BV_PATTERN = /BV[A-Za-z0-9]{8,}/g;

export interface BiliLinkSegment {
  type: "text";
  content: string;
}

export interface BiliLinkBV {
  type: "bv";
  bvId: string;
  url: string;
}

export type BiliLinkToken = BiliLinkSegment | BiliLinkBV;

/** 将文本拆分为纯文本段与 BV 链接段。 */
export function parseBiliLinks(text: string): BiliLinkToken[] {
  BV_PATTERN.lastIndex = 0;
  const tokens: BiliLinkToken[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(BV_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, start) });
    }
    const bvId = match[0];
    tokens.push({ type: "bv", bvId, url: `https://www.bilibili.com/video/${bvId}/` });
    lastIndex = start + bvId.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }
  return tokens;
}

/** 文本中是否包含 BV 号。 */
export function hasBiliLink(text: string): boolean {
  BV_PATTERN.lastIndex = 0;
  return BV_PATTERN.test(text);
}
