import { describe, it, expect } from "vitest";
import { toRomaji } from "../src/liveEvents/romaji";

describe("toRomaji 罗马音标注（含假名才转换）", () => {
  it("含假名：kuroshiro 全文转换（按小节分开）", async () => {
    expect(await toRomaji("ありがとう")).toBe("arigatō");
    expect(await toRomaji("魔法少女さん")).toBe("mahō shōjo san");
    expect(await toRomaji("テスト")).toBe("tesuto");
  });

  it("简体中文汉字：经 cn→jp 转日文汉字后全文转换", async () => {
    expect(await toRomaji("学习ちゃん")).toBe("gakushū chan");
    expect(await toRomaji("风铃ちゃん")).toBe("fūrin chan");
    expect(await toRomaji("说话ちゃん")).toBe("setsuwa chan");
    expect(await toRomaji("汉字ちゃん")).toBe("kanji chan");
  });

  it("简繁转换后仍残留：兜底仅转写假名（非假名字符原样保留）", async () => {
    expect(await toRomaji("堇宝ちゃん")).toBe("堇宝chan");
    expect(await toRomaji("ありがとう枝堇")).toBe("arigatou枝堇");
    expect(await toRomaji("测试ちゃん")).toBe("测试chan");
  });

  it("无假名（纯汉字 / 英文 / 数字）返回 null", async () => {
    expect(await toRomaji("魔法少女")).toBeNull();
    expect(await toRomaji("枝堇")).toBeNull();
    expect(await toRomaji("测试观众")).toBeNull();
    expect(await toRomaji("abc")).toBeNull();
    expect(await toRomaji("")).toBeNull();
  });
});
