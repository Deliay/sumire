/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHoverPills } from "@/features/danmaku/useHoverPills";
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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useHoverPills 胶囊集合", () => {
  it("add 加入 hoverable 且类型匹配的事件", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat", "guard_buy"]));
    const sc = makeEvent({ type: "super_chat", price: 30, time: 60 });
    act(() => result.current.add(sc));
    expect(result.current.pills).toHaveLength(1);
    expect(result.current.pills[0].eventId).toBe("test:1");
    expect(result.current.pills[0].kind).toBe("sc");
    expect(result.current.pills[0].price).toBe(30);
  });

  it("类型不匹配的事件不加入", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat"]));
    const guard = makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 3 } });
    act(() => result.current.add(guard));
    expect(result.current.pills).toHaveLength(0);
  });

  it("非 hoverable 事件不加入", () => {
    const { result } = renderHook(() => useHoverPills(["danmaku", "super_chat"]));
    const dm = makeEvent({ type: "danmaku" });
    act(() => result.current.add(dm));
    expect(result.current.pills).toHaveLength(0);
  });

  it("同一 eventId 重复 add 覆盖（刷新 arrivedAt/expiresAt）", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat"]));
    const sc1 = makeEvent({ eventId: "sc:1", type: "super_chat", price: 30, time: 60 });
    const sc2 = makeEvent({ eventId: "sc:1", type: "super_chat", price: 50, time: 120 });
    act(() => result.current.add(sc1));
    const firstExpires = result.current.pills[0].expiresAt;
    act(() => {
      vi.advanceTimersByTime(1000);
      result.current.add(sc2);
    });
    expect(result.current.pills).toHaveLength(1);
    expect(result.current.pills[0].price).toBe(50);
    expect(result.current.pills[0].expiresAt).toBeGreaterThan(firstExpires);
  });

  it("到期胶囊被移除", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat"]));
    const sc = makeEvent({ type: "super_chat", price: 30, time: 60 });
    act(() => result.current.add(sc));
    expect(result.current.pills).toHaveLength(1);
    act(() => vi.advanceTimersByTime(61000));
    expect(result.current.pills).toHaveLength(0);
  });

  it("未到期胶囊保留", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat"]));
    const sc = makeEvent({ type: "super_chat", price: 30, time: 60 });
    act(() => result.current.add(sc));
    act(() => vi.advanceTimersByTime(50000));
    expect(result.current.pills).toHaveLength(1);
  });

  it("pills 按 pillSort 排序（金额降序）", () => {
    const { result } = renderHook(() => useHoverPills(["super_chat"]));
    const sc1 = makeEvent({ eventId: "sc:1", type: "super_chat", price: 30, time: 60 });
    const sc2 = makeEvent({ eventId: "sc:2", type: "super_chat", price: 100, time: 60 });
    act(() => result.current.add(sc1));
    act(() => result.current.add(sc2));
    expect(result.current.pills[0].price).toBe(100);
    expect(result.current.pills[1].price).toBe(30);
  });

  it("types 变化时重建 add 回调", () => {
    const { result, rerender } = renderHook(
      ({ types }) => useHoverPills(types),
      { initialProps: { types: ["super_chat"] as const } }
    );
    const guard = makeEvent({ type: "guard_buy", sender: { uid: 1, name: "", nameRomaji: null, face: null, medal: null, guardLevel: 3 } });
    act(() => result.current.add(guard));
    expect(result.current.pills).toHaveLength(0);
    rerender({ types: ["super_chat", "guard_buy"] });
    act(() => result.current.add(guard));
    expect(result.current.pills).toHaveLength(1);
  });

  it("卸载时清理 interval（无泄漏）", () => {
    const { unmount } = renderHook(() => useHoverPills(["super_chat"]));
    unmount();
    vi.runAllTimers();
  });
});
