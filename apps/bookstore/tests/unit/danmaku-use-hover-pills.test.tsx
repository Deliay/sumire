/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHoverPills } from "@/features/danmaku/useHoverPills";
import type { LiveEvent, LiveEventType } from "@/features/danmaku/types";

function makeEvent(overrides: Partial<LiveEvent> & { type: LiveEvent["type"] }): LiveEvent {
  return {
    eventId: "test:1",
    occurredAt: "2026-01-01T00:00:00Z",
    sender: { uid: 1, name: "test", nameRomaji: null, face: null, medal: null, guardLevel: null },
    read: false,
    ...overrides,
  };
}

const FIXED_TIME = new Date("2026-01-01T00:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_TIME);
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
      { initialProps: { types: ["super_chat"] as readonly LiveEventType[] } }
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

  describe("历史事件入胶囊 + expiresAt 从 occurredAt 起算", () => {
    it("历史事件（occurredAt 早于 now 30s，duration 60s）剩余 30s 入列", () => {
      // FIXED_TIME = 2026-01-01T00:00:00Z
      // 事件发生在 30s 前
      const pastTime = new Date(FIXED_TIME - 30000).toISOString();
      const { result } = renderHook(() => useHoverPills(["super_chat"]));
      const sc = makeEvent({ type: "super_chat", price: 30, time: 60, occurredAt: pastTime });
      act(() => result.current.add(sc));
      expect(result.current.pills).toHaveLength(1);
      // expiresAt = occurredAtMs + 60000 = (FIXED_TIME - 30000) + 60000 = FIXED_TIME + 30000
      expect(result.current.pills[0].expiresAt).toBe(FIXED_TIME + 30000);
    });

    it("历史事件（occurredAt 距今超过 duration）add 时不加入", () => {
      // 事件发生在 70s 前，duration 默认 60s，已过期
      const pastTime = new Date(FIXED_TIME - 70000).toISOString();
      const { result } = renderHook(() => useHoverPills(["super_chat"]));
      const sc = makeEvent({ type: "super_chat", price: 30, time: 60, occurredAt: pastTime });
      act(() => result.current.add(sc));
      // 已过期，不加入
      expect(result.current.pills).toHaveLength(0);
    });

    it("历史事件（刚发生，剩余时长大于0）正常入列", () => {
      // 事件发生在 5s 前
      const pastTime = new Date(FIXED_TIME - 5000).toISOString();
      const { result } = renderHook(() => useHoverPills(["super_chat"]));
      const sc = makeEvent({ type: "super_chat", price: 30, time: 60, occurredAt: pastTime });
      act(() => result.current.add(sc));
      expect(result.current.pills).toHaveLength(1);
      // expiresAt = occurredAtMs + 60000 = (FIXED_TIME - 5000) + 60000 = FIXED_TIME + 55000
      expect(result.current.pills[0].expiresAt).toBe(FIXED_TIME + 55000);
    });

    it("实时事件（occurredAt = now）入列后按时倒计时", () => {
      const { result } = renderHook(() => useHoverPills(["super_chat"]));
      const sc = makeEvent({ type: "super_chat", price: 30, time: 60, occurredAt: new Date(FIXED_TIME).toISOString() });
      act(() => result.current.add(sc));
      expect(result.current.pills).toHaveLength(1);
      // expiresAt = FIXED_TIME + 60000
      expect(result.current.pills[0].expiresAt).toBe(FIXED_TIME + 60000);
      // 50s 后仍在
      act(() => vi.advanceTimersByTime(50000));
      expect(result.current.pills).toHaveLength(1);
      // 61s 后过期
      act(() => vi.advanceTimersByTime(11000));
      expect(result.current.pills).toHaveLength(0);
    });

    it("guard_buy 历史事件也按 occurredAt 起算", () => {
      // 舰长 duration=60s，事件发生在 40s 前
      const pastTime = new Date(FIXED_TIME - 40000).toISOString();
      const { result } = renderHook(() => useHoverPills(["guard_buy"]));
      const guard = makeEvent({
        type: "guard_buy",
        occurredAt: pastTime,
        sender: { uid: 1, name: "test", nameRomaji: null, face: null, medal: null, guardLevel: 3 },
      });
      act(() => result.current.add(guard));
      expect(result.current.pills).toHaveLength(1);
      // expiresAt = occurredAtMs + 60000 = (FIXED_TIME - 40000) + 60000 = FIXED_TIME + 20000
      expect(result.current.pills[0].expiresAt).toBe(FIXED_TIME + 20000);
    });
  });
});
