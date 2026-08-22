// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHideLowSc,
  saveHideLowSc,
  isScHidden,
  HIDE_LOW_SC_STORAGE_KEY,
  getHideLowScSnapshot,
  getHideLowScServerSnapshot,
} from "@/features/danmaku/hideLowSc";

describe("isScHidden 纯函数", () => {
  it("undefined price → false（不隐藏）", () => {
    expect(isScHidden(undefined)).toBe(false);
  });

  it("price < 30 → true（隐藏）", () => {
    expect(isScHidden(0)).toBe(true);
    expect(isScHidden(1)).toBe(true);
    expect(isScHidden(29)).toBe(true);
    expect(isScHidden(29.99)).toBe(true);
  });

  it("price >= 30 → false（不隐藏）", () => {
    expect(isScHidden(30)).toBe(false);
    expect(isScHidden(31)).toBe(false);
    expect(isScHidden(100)).toBe(false);
  });
});

describe("loadHideLowSc / saveHideLowSc", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时回退 false（默认关闭）", () => {
    expect(loadHideLowSc()).toBe(false);
  });

  it("存取往返：保存 true/false 后读回一致", () => {
    saveHideLowSc(true);
    expect(loadHideLowSc()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(HIDE_LOW_SC_STORAGE_KEY)!)).toBe(true);
    saveHideLowSc(false);
    expect(loadHideLowSc()).toBe(false);
  });

  it("存储非 boolean JSON（\"1\"/\"yes\"/数字）回退 false", () => {
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, JSON.stringify("1"));
    expect(loadHideLowSc()).toBe(false);
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, JSON.stringify("yes"));
    expect(loadHideLowSc()).toBe(false);
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, JSON.stringify(1));
    expect(loadHideLowSc()).toBe(false);
  });

  it("存储损坏（坏 JSON）回退 false", () => {
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, "not-json");
    expect(loadHideLowSc()).toBe(false);
  });
});

describe("useSyncExternalStore 快照缓存", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("getHideLowScSnapshot 读取当前值", () => {
    expect(getHideLowScSnapshot()).toBe(false);
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, "true");
    expect(getHideLowScSnapshot()).toBe(true);
  });

  it("getHideLowScServerSnapshot 恒返回 false", () => {
    expect(getHideLowScServerSnapshot()).toBe(false);
  });

  it("raw 未变时 getHideLowScSnapshot 返回稳定引用", () => {
    const a = getHideLowScSnapshot();
    const b = getHideLowScSnapshot();
    expect(a).toBe(b);
  });

  it("raw 变化后 getHideLowScSnapshot 返回新引用", () => {
    const a = getHideLowScSnapshot();
    window.localStorage.setItem(HIDE_LOW_SC_STORAGE_KEY, "true");
    const b = getHideLowScSnapshot();
    expect(b).toBe(true);
    expect(a).not.toBe(b);
  });
});
