import { describe, it, expect } from "vitest";
import { parseBiliLinks, hasBiliLink } from "@/features/danmaku/biliVideo";

describe("parseBiliLinks", () => {
  it("纯文本无 BV 号时返回单个 text 段", () => {
    const tokens = parseBiliLinks("你好世界");
    expect(tokens).toEqual([{ type: "text", content: "你好世界" }]);
  });

  it("文本中包含一个 BV 号时拆分三段", () => {
    const tokens = parseBiliLinks("看看这个 BV1DNbv6oEnm 视频");
    expect(tokens).toEqual([
      { type: "text", content: "看看这个 " },
      { type: "bv", bvId: "BV1DNbv6oEnm", url: "https://www.bilibili.com/video/BV1DNbv6oEnm/" },
      { type: "text", content: " 视频" },
    ]);
  });

  it("文本中包含多个 BV 号时逐个拆分", () => {
    const tokens = parseBiliLinks("BV1xxxxxaaaa BV2yyyyybbbb");
    expect(tokens).toEqual([
      { type: "bv", bvId: "BV1xxxxxaaaa", url: "https://www.bilibili.com/video/BV1xxxxxaaaa/" },
      { type: "text", content: " " },
      { type: "bv", bvId: "BV2yyyyybbbb", url: "https://www.bilibili.com/video/BV2yyyyybbbb/" },
    ]);
  });

  it("BV 号在开头时前面无 text 段", () => {
    const tokens = parseBiliLinks("BV1DNbv6oEnm好看");
    expect(tokens[0]).toEqual({ type: "bv", bvId: "BV1DNbv6oEnm", url: "https://www.bilibili.com/video/BV1DNbv6oEnm/" });
    expect(tokens[1]).toEqual({ type: "text", content: "好看" });
  });

  it("BV 号在结尾时后面无 text 段", () => {
    const tokens = parseBiliLinks("好看BV1DNbv6oEnm");
    expect(tokens[0]).toEqual({ type: "text", content: "好看" });
    expect(tokens[1]).toEqual({ type: "bv", bvId: "BV1DNbv6oEnm", url: "https://www.bilibili.com/video/BV1DNbv6oEnm/" });
  });

  it("不匹配少于 8 位的 BV 号", () => {
    const tokens = parseBiliLinks("BV1234567 不是");
    expect(tokens).toEqual([{ type: "text", content: "BV1234567 不是" }]);
  });

  it("匹配 8 位 BV 号", () => {
    const tokens = parseBiliLinks("BV12345678 是");
    expect(tokens).toEqual([
      { type: "bv", bvId: "BV12345678", url: "https://www.bilibili.com/video/BV12345678/" },
      { type: "text", content: " 是" },
    ]);
  });
});

describe("hasBiliLink", () => {
  it("包含 BV 号返回 true", () => {
    expect(hasBiliLink("看看 BV1DNbv6oEnm")).toBe(true);
  });

  it("不包含 BV 号返回 false", () => {
    expect(hasBiliLink("没有链接")).toBe(false);
  });
});
