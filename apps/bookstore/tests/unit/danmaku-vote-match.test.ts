import { describe, it, expect } from "vitest";
import { matchVote, hasKeywordConflict } from "@/features/danmaku-tools/vote/match";
import { voteStateSchema } from "@/features/danmaku-tools/vote/types";

describe("matchVote", () => {
  const options = [
    { id: "1", name: "选项A", keyword: "唱歌", count: 0 },
    { id: "2", name: "选项B", keyword: "游戏", count: 0 },
  ];

  it("恰好单命中返回选项 id", () => {
    expect(matchVote("大家来唱歌吧", options)).toBe("1");
    expect(matchVote("今天玩游戏", options)).toBe("2");
  });

  it("0 命中返回 null", () => {
    expect(matchVote("今天天气真好", options)).toBeNull();
  });

  it("多命中返回 null", () => {
    expect(matchVote("唱歌和游戏都好玩", options)).toBeNull();
  });

  it("关键字在弹幕任意位置命中", () => {
    expect(matchVote("唱歌是爱好", options)).toBe("1");
    expect(matchVote("我喜欢唱歌", options)).toBe("1");
    expect(matchVote("唱歌", options)).toBe("1");
  });

  it("空 options 返回 null", () => {
    expect(matchVote("唱歌", [])).toBeNull();
  });

  it("大小写敏感", () => {
    const optionsWithCase = [
      { id: "3", name: "选项C", keyword: "Hello", count: 0 },
    ];
    expect(matchVote("hello world", optionsWithCase)).toBeNull();
    expect(matchVote("Hello world", optionsWithCase)).toBe("3");
  });
});

describe("hasKeywordConflict", () => {
  const existingOptions = [
    { id: "1", name: "选项A", keyword: "唱歌", count: 0 },
    { id: "2", name: "选项B", keyword: "游戏", count: 0 },
  ];

  it("A vs AA 冲突", () => {
    expect(hasKeywordConflict("唱歌", existingOptions)).toBe(true);
  });

  it("AA vs A 冲突", () => {
    const existingWithLonger = [
      { id: "1", name: "选项A", keyword: "唱歌跳舞", count: 0 },
    ];
    expect(hasKeywordConflict("唱歌", existingWithLonger)).toBe(true);
  });

  it("完全相同冲突", () => {
    expect(hasKeywordConflict("唱歌", existingOptions)).toBe(true);
  });

  it("无冲突", () => {
    expect(hasKeywordConflict("跳舞", existingOptions)).toBe(false);
  });

  it("多既有选项任一冲突即 true", () => {
    const existingWithOptions = [
      { id: "1", name: "选项A", keyword: "唱歌", count: 0 },
      { id: "2", name: "选项B", keyword: "游戏", count: 0 },
    ];
    expect(hasKeywordConflict("跳舞", existingWithOptions)).toBe(false);
    expect(hasKeywordConflict("唱", existingWithOptions)).toBe(true);
  });
});

describe("voteStateSchema", () => {
  it("合法状态通过", () => {
    const validState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: 5 },
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456, 789012],
    };
    expect(voteStateSchema.safeParse(validState).success).toBe(true);
  });

  it("count 负数拒绝", () => {
    const invalidState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: -1 },
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    expect(voteStateSchema.safeParse(invalidState).success).toBe(false);
  });

  it("voterUids 非整数拒绝", () => {
    const invalidState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: 0 },
      ],
      processed: 10,
      matched: 5,
      voterUids: [123.456],
    };
    expect(voteStateSchema.safeParse(invalidState).success).toBe(false);
  });

  it("缺字段拒绝", () => {
    const invalidState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌" }, // 缺 count
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    expect(voteStateSchema.safeParse(invalidState).success).toBe(false);
  });
});
