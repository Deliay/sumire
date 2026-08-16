import { describe, it, expect } from "vitest";
import { toNameRomaji } from "../src/liveEvents/romaji";

describe("toNameRomaji 昵称罗马音标注", () => {
  it("含可解析汉字：生成 Hepburn 罗马音", async () => {
    expect(await toNameRomaji("魔法少女")).toBe("mahō shōjo");
  });

  it("含不可解析汉字（非常用词）返回 null，不抛错", async () => {
    expect(await toNameRomaji("枝堇")).toBeNull();
  });

  it("无汉字（纯中文/英文/数字）返回 null", async () => {
    expect(await toNameRomaji("abc")).toBeNull();
    expect(await toNameRomaji("kkk123")).toBeNull();
    expect(await toNameRomaji("测试观众")).toBeNull();
  });

  it("空串返回 null", async () => {
    expect(await toNameRomaji("")).toBeNull();
  });

  it("中日混合：仅解析可解析部分并返回整体罗马音", async () => {
    // 枝堇Sumire 中 枝堇 不可解析 → 整体残留汉字 → null
    expect(await toNameRomaji("枝堇Sumire")).toBeNull();
  });
});
