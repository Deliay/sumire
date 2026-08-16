import { describe, it, expect } from "vitest";
import { toRomaji } from "../src/liveEvents/romaji";

describe("toRomaji 假名罗马音标注", () => {
  it("含平假名：生成 Hepburn 罗马音", async () => {
    expect(await toRomaji("ありがとう")).toBe("arigatou");
    expect(await toRomaji("たけし")).toBe("takeshi");
    expect(await toRomaji("まほうしょうじょ")).toBe("mahoushoujo");
  });

  it("含片假名：生成 Hepburn 罗马音（长音 ー 转 macron）", async () => {
    expect(await toRomaji("テスト")).toBe("tesuto");
    expect(await toRomaji("コーヒー")).toBe("kōhī");
  });

  it("拗音 / 促音 / 拨音：きょう→kyou、がっこう→gakkou、しんぶん→shinbun", async () => {
    expect(await toRomaji("きょう")).toBe("kyou");
    expect(await toRomaji("がっこう")).toBe("gakkou");
    expect(await toRomaji("しんぶん")).toBe("shinbun");
    expect(await toRomaji("せんぱい")).toBe("senpai");
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

  it("中日混合：仅转写假名部分，汉字原样保留", async () => {
    expect(await toRomaji("魔法少女さん")).toBe("魔法少女san");
    expect(await toRomaji("かな漢字")).toBe("kana漢字");
  });
});
