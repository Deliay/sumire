// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadVoteState,
  saveVoteState,
  clearVoteState,
  VOTE_STORAGE_KEY,
} from "@/features/danmaku-tools/vote/store";
import { EMPTY_VOTE_STATE } from "@/features/danmaku-tools/vote/types";

describe("loadVoteState / saveVoteState / clearVoteState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时返回空态", () => {
    const state = loadVoteState();
    expect(state).toEqual(EMPTY_VOTE_STATE);
    expect(state).not.toBe(EMPTY_VOTE_STATE); // 应该是拷贝
  });

  it("存取往返一致", () => {
    const state = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: 5 },
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456, 789012],
    };
    saveVoteState(state);
    const loaded = loadVoteState();
    expect(loaded).toEqual(state);
  });

  it("非法 JSON 回退空态", () => {
    window.localStorage.setItem(VOTE_STORAGE_KEY, "not-json");
    const state = loadVoteState();
    expect(state).toEqual(EMPTY_VOTE_STATE);
  });

  it("结构不符（缺字段）回退空态", () => {
    const invalidState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌" }, // 缺 count
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(invalidState));
    const state = loadVoteState();
    expect(state).toEqual(EMPTY_VOTE_STATE);
  });

  it("结构不符（类型错误）回退空态", () => {
    const invalidState = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: -1 }, // 负数
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(invalidState));
    const state = loadVoteState();
    expect(state).toEqual(EMPTY_VOTE_STATE);
  });

  it("clear 后 load 为空态", () => {
    const state = {
      options: [
        { id: "1", name: "选项A", keyword: "唱歌", count: 5 },
      ],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    saveVoteState(state);
    clearVoteState();
    const loaded = loadVoteState();
    expect(loaded).toEqual(EMPTY_VOTE_STATE);
  });

  it("返回的空态是拷贝", () => {
    const state1 = loadVoteState();
    const state2 = loadVoteState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});
