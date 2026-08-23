import { describe, it, expect } from "vitest";
import { isHoverable, pillPrice, hoverDuration, pillKind, pillSort, SC_DEFAULT_SECONDS } from "@/features/danmaku/hoverTopBar";
import type { LiveEvent } from "@/features/danmaku/types";

function makeEvent(overrides: Partial<LiveEvent> & { type: LiveEvent["type"] }): LiveEvent {
  return {
    eventId: "test:1",
    occurredAt: "2026-01-01T00:00:00Z",
    sender: { uid: 1, name: "test", nameRomaji: null, face: null, medal: null, guardLevel: null },
    read: false,
    ...overrides,
  };
}

describe("isHoverable 可悬停判定", () => {
  it("super_chat / guard_buy 为 true", () => {
    expect(isHoverable(makeEvent({ type: "super_chat" }))).toBe(true);
    expect(isHoverable(makeEvent({ type: "guard_buy" }))).toBe(true);
  });

  it("danmaku / gift 为 false", () => {
    expect(isHoverable(makeEvent({ type: "danmaku" }))).toBe(false);
    expect(isHoverable(makeEvent({ type: "gift" }))).toBe(false);
  });
});

describe("pillPrice 金额提取", () => {
  it("price 为 number 时取其值", () => {
    expect(pillPrice(makeEvent({ type: "super_chat", price: 30 }))).toBe(30);
  });

  it("price 缺失时返回 0", () => {
    expect(pillPrice(makeEvent({ type: "super_chat" }))).toBe(0);
  });
});

describe("hoverDuration 悬停时长（秒）", () => {
  it("super_chat：取 event.time（> 0）", () => {
    expect(hoverDuration(makeEvent({ type: "super_chat", time: 300 }))).toBe(300);
  });

  it("super_chat：time 缺失/0/负数 → SC_DEFAULT_SECONDS", () => {
    expect(hoverDuration(makeEvent({ type: "super_chat" }))).toBe(SC_DEFAULT_SECONDS);
    expect(hoverDuration(makeEvent({ type: "super_chat", time: 0 }))).toBe(SC_DEFAULT_SECONDS);
    expect(hoverDuration(makeEvent({ type: "super_chat", time: -1 }))).toBe(SC_DEFAULT_SECONDS);
  });

  it("guard_buy：level 3→60, 2→300, 1→3600", () => {
    expect(hoverDuration(makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 3 } }))).toBe(60);
    expect(hoverDuration(makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 2 } }))).toBe(300);
    expect(hoverDuration(makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 1 } }))).toBe(3600);
  });

  it("guard_buy：level 缺失/未知 → 60", () => {
    expect(hoverDuration(makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: null } }))).toBe(60);
    expect(hoverDuration(makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 99 } }))).toBe(60);
  });
});

describe("pillKind 胶囊类型", () => {
  it("super_chat → sc", () => {
    expect(pillKind(makeEvent({ type: "super_chat" }))).toBe("sc");
  });

  it("guard_buy → guard", () => {
    expect(pillKind(makeEvent({ type: "guard_buy" }))).toBe("guard");
  });
});

describe("pillSort 排序", () => {
  it("金额降序", () => {
    const a = { price: 30 } as any;
    const b = { price: 100 } as any;
    expect(pillSort(a, b)).toBeGreaterThan(0);
    expect(pillSort(b, a)).toBeLessThan(0);
  });

  it("金额相同 → arrivedAt 降序（新者优先）", () => {
    const a = { price: 30, arrivedAt: 1000 } as any;
    const b = { price: 30, arrivedAt: 2000 } as any;
    expect(pillSort(a, b)).toBeGreaterThan(0);
    expect(pillSort(b, a)).toBeLessThan(0);
  });
});
