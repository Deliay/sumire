// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { loadMergeEnabled, saveMergeEnabled, MERGE_ENABLED_STORAGE_KEY } from "@/features/danmaku/mergeEnabled";

describe("loadMergeEnabled / saveMergeEnabled", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时默认 false", () => {
    expect(loadMergeEnabled()).toBe(false);
  });

  it("保存 true 后读取 true", () => {
    saveMergeEnabled(true);
    expect(loadMergeEnabled()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(MERGE_ENABLED_STORAGE_KEY)!)).toBe(true);
  });

  it("保存 false 后读取 false", () => {
    saveMergeEnabled(false);
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存取往返：true → false → true", () => {
    saveMergeEnabled(true);
    expect(loadMergeEnabled()).toBe(true);
    saveMergeEnabled(false);
    expect(loadMergeEnabled()).toBe(false);
    saveMergeEnabled(true);
    expect(loadMergeEnabled()).toBe(true);
  });

  it("存储损坏回退 false", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, "not-json");
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储为 \"1\" 回退 false（仅 boolean true 通过）", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify("1"));
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储为 \"yes\" 回退 false（仅 boolean true 通过）", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify("yes"));
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储为数字 1 回退 false（仅 boolean true 通过）", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify(1));
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储为 boolean false 读取 false", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify(false));
    expect(loadMergeEnabled()).toBe(false);
  });
});
