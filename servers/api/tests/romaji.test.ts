import { describe, it, expect } from "vitest";
import { toRomaji } from "../src/liveEvents/romaji";

describe("toRomaji 罗马音标注（含假名全文转换）", () => {
  it("含假名：全文生成 Hepburn 罗马音（按小节分开）", async () => {
    expect(await toRomaji("ありがとう")).toBe("arigatō");
    expect(await toRomaji("こんにちは")).toBe("konnichiwa");
    expect(await toRomaji("テスト")).toBe("tesuto");
    expect(await toRomaji("かわいい")).toBe("kawaii");
  });

  it("汉字与假名混合：全文转换（汉字读音 + 假名）", async () => {
    expect(await toRomaji("魔法少女さん")).toBe("mahō shōjo san");
  });

  it("无假名（纯汉字 / 英文 / 数字）返回 null", async () => {
    expect(await toRomaji("魔法少女")).toBeNull();
    expect(await toRomaji("枝堇")).toBeNull();
    expect(await toRomaji("abc")).toBeNull();
    expect(await toRomaji("kkk123")).toBeNull();
    expect(await toRomaji("测试观众")).toBeNull();
  });

  it("空串返回 null", async () => {
    expect(await toRomaji("")).toBeNull();
  });

  it("含不可解析汉字残留时返回 null，不抛错", async () => {
    // 枝堇 为非常用词，全文转换后仍残留汉字 → null
    expect(await toRomaji("ありがとう枝堇")).toBeNull();
    expect(await toRomaji("枝堇Sumire")).toBeNull();
  });
});
