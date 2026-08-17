// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { clampMinPrice, loadGiftMinPrice, saveGiftMinPrice, MIN_PRICE_STORAGE_KEY } from "@/features/danmaku/giftMinPrice";

describe("clampMinPrice", () => {
  it("合法值原样返回", () => {
    expect(clampMinPrice(5)).toBe(5);
    expect(clampMinPrice(0)).toBe(0);
    expect(clampMinPrice(100)).toBe(100);
  });

  it("四舍五入到 0.1 步进", () => {
    expect(clampMinPrice(5.05)).toBe(5.1);
    expect(clampMinPrice(5.04)).toBe(5);
  });

  it("负数夹取到 0", () => {
    expect(clampMinPrice(-1)).toBe(0);
  });

  it("超过 100 夹取到 100", () => {
    expect(clampMinPrice(101)).toBe(100);
  });

  it("非有限数字回退 0", () => {
    expect(clampMinPrice(NaN)).toBe(0);
    expect(clampMinPrice(Infinity)).toBe(0);
    expect(clampMinPrice("abc")).toBe(0);
    expect(clampMinPrice(null)).toBe(0);
    expect(clampMinPrice(undefined)).toBe(0);
  });
});

describe("loadGiftMinPrice / saveGiftMinPrice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时回退 0", () => {
    expect(loadGiftMinPrice()).toBe(0);
  });

  it("保存后读取", () => {
    saveGiftMinPrice(5.5);
    expect(loadGiftMinPrice()).toBe(5.5);
    expect(JSON.parse(window.localStorage.getItem(MIN_PRICE_STORAGE_KEY)!)).toBe(5.5);
  });

  it("保存时夹取非法值", () => {
    saveGiftMinPrice(-1);
    expect(loadGiftMinPrice()).toBe(0);
    saveGiftMinPrice(101);
    expect(loadGiftMinPrice()).toBe(100);
  });

  it("存储损坏回退 0", () => {
    window.localStorage.setItem(MIN_PRICE_STORAGE_KEY, "not-json");
    expect(loadGiftMinPrice()).toBe(0);
  });

  it("存储非法值（NaN）回退 0", () => {
    window.localStorage.setItem(MIN_PRICE_STORAGE_KEY, "NaN");
    expect(loadGiftMinPrice()).toBe(0);
  });
});
