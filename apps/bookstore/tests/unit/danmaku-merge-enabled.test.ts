// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadMergeEnabled,
  saveMergeEnabled,
  MERGE_ENABLED_STORAGE_KEY,
} from "@/features/danmaku/mergeEnabled";

describe("loadMergeEnabled / saveMergeEnabled", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时回退 false（默认关闭）", () => {
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存取往返：保存 true/false 后读回一致", () => {
    saveMergeEnabled(true);
    expect(loadMergeEnabled()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(MERGE_ENABLED_STORAGE_KEY)!)).toBe(true);
    saveMergeEnabled(false);
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储非 boolean JSON（\"1\"/\"yes\"/数字）回退 false", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify("1"));
    expect(loadMergeEnabled()).toBe(false);
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify("yes"));
    expect(loadMergeEnabled()).toBe(false);
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify(1));
    expect(loadMergeEnabled()).toBe(false);
  });

  it("存储损坏（坏 JSON）回退 false", () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, "not-json");
    expect(loadMergeEnabled()).toBe(false);
  });
});
