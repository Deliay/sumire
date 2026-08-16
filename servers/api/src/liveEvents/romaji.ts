/**
 * 假名罗马音标注：对含假名（平假名 / 片假名）的文本生成 Hepburn 罗马音。
 * 采用 hepburn 库纯假名转写，无形态分析字典：不含假名返回 null，绝不抛错。
 * 非假名字符（汉字 / 拉丁 / 数字 / 标点）原样保留，仅转写假名部分。
 */

import { fromKana, containsKana } from "hepburn";

/** 文本 → 罗马音标注；无假名或转写结果为空返回 null。 */
export function toRomaji(text: string): string | null {
  if (!text || !containsKana(text)) return null;
  const romaji = fromKana(text).trim().toLowerCase();
  return romaji || null;
}
