import { describe, expect, it } from "vitest";
import { splitByKeyword, formatOccurredAt } from "../../features/danmaku/search/highlight";

describe("splitByKeyword", () => {
  it("空关键词返回原文单段", () => {
    expect(splitByKeyword("hello world", "")).toEqual([{ text: "hello world", hit: false }]);
  });

  it("空内容返回空文本段", () => {
    expect(splitByKeyword("", "keyword")).toEqual([{ text: "", hit: false }]);
  });

  it("未命中返回单段 hit:false", () => {
    expect(splitByKeyword("hello world", "xyz")).toEqual([{ text: "hello world", hit: false }]);
  });

  it("单次命中切分为三段", () => {
    const result = splitByKeyword("hello world foo", "world");
    expect(result).toEqual([
      { text: "hello ", hit: false },
      { text: "world", hit: true },
      { text: " foo", hit: false },
    ]);
  });

  it("多次命中分别高亮", () => {
    const result = splitByKeyword("aaa bbb aaa bbb aaa", "bbb");
    expect(result).toEqual([
      { text: "aaa ", hit: false },
      { text: "bbb", hit: true },
      { text: " aaa ", hit: false },
      { text: "bbb", hit: true },
      { text: " aaa", hit: false },
    ]);
  });

  it("连续命中合并为一段", () => {
    const result = splitByKeyword("aaaa", "aa");
    expect(result).toEqual([{ text: "aaaa", hit: true }]);
  });

  it("正则元字符关键词正常工作", () => {
    const result = splitByKeyword("price is $10.00 (USD)", "$10.00");
    expect(result).toEqual([
      { text: "price is ", hit: false },
      { text: "$10.00", hit: true },
      { text: " (USD)", hit: false },
    ]);
  });

  it("大小写不敏感匹配", () => {
    const result = splitByKeyword("Hello World", "hello");
    expect(result).toEqual([
      { text: "Hello", hit: true },
      { text: " World", hit: false },
    ]);
  });

  it("连续命中合并：多个紧邻的匹配合并为一段", () => {
    const result = splitByKeyword("abcabc", "abc");
    expect(result).toEqual([{ text: "abcabc", hit: true }]);
  });

  it("不相邻的匹配不合并", () => {
    const result = splitByKeyword("ab abc ab", "abc");
    expect(result).toEqual([
      { text: "ab ", hit: false },
      { text: "abc", hit: true },
      { text: " ab", hit: false },
    ]);
  });
});

describe("formatOccurredAt", () => {
  it("格式化 ISO 时间为 MM/DD HH:mm", () => {
    const result = formatOccurredAt("2026-08-01T12:30:00.000Z");
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it("非法时间返回原字符串", () => {
    expect(formatOccurredAt("not-a-date")).toBe("not-a-date");
  });
});
