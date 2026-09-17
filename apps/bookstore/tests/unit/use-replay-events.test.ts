// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import { WINDOW_MS, toIso } from "@/features/recordings/replay/replayWindows";

const h = vi.hoisted(() => ({ fetchReplayEvents: vi.fn() }));

vi.mock("@/features/recordings/replay/replayEvents", () => ({ fetchReplayEvents: h.fetchReplayEvents }));

import { useReplayEvents } from "@/features/recordings/replay/useReplayEvents";

const START = Date.parse("2026-09-17T10:00:00.000Z");
const SENDER: LiveEvent["sender"] = {
  uid: 1,
  name: "观众",
  nameRomaji: null,
  face: null,
  medal: null,
  guardLevel: null,
};

function ev(id: string, atMs: number): LiveEvent {
  return { eventId: id, type: "danmaku", occurredAt: new Date(atMs).toISOString(), sender: SENDER, content: id, read: false };
}

function mockPages(total: number, pageSize = 100) {
  h.fetchReplayEvents.mockImplementation(async ({ page }: { page?: number }) => {
    const current = page ?? 1;
    const startIdx = (current - 1) * pageSize;
    const count = Math.max(0, Math.min(pageSize, total - startIdx));
    const items = Array.from({ length: count }, (_, i) => ev(`e${startIdx + i}`, START + (startIdx + i) * 1000));
    return { ok: true, total, items };
  });
}

afterEach(() => {
  cleanup();
  h.fetchReplayEvents.mockReset();
  vi.restoreAllMocks();
});

describe("useReplayEvents 窗口加载调度", () => {
  it("首屏加载首窗；缓存命中时 ensureWindow 跳过请求", async () => {
    mockPages(1);
    const { result } = renderHook(() => useReplayEvents({ startMs: START, endMs: null }));

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    const callsAfterInitial = h.fetchReplayEvents.mock.calls.length;

    await act(async () => {
      await result.current.ensureWindow(0);
    });
    expect(h.fetchReplayEvents.mock.calls.length).toBe(callsAfterInitial);
  });

  it("单窗 total 超过单页时翻页取尽（page 递增）", async () => {
    mockPages(250);
    const { result } = renderHook(() => useReplayEvents({ startMs: START, endMs: null }));

    await waitFor(() => expect(result.current.events).toHaveLength(250));
    expect(h.fetchReplayEvents).toHaveBeenCalledTimes(3);
    const pages = h.fetchReplayEvents.mock.calls.map(([p]) => (p as { page: number }).page);
    expect(pages).toEqual([1, 2, 3]);
  });

  it("播放进入窗口后半段：prefetchNext 预取下一窗；前半段不预取", async () => {
    mockPages(0);
    const { result } = renderHook(() => useReplayEvents({ startMs: START, endMs: null }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = h.fetchReplayEvents.mock.calls.length;

    act(() => result.current.prefetchNext(WINDOW_MS * 0.25));
    expect(h.fetchReplayEvents.mock.calls.length).toBe(before);

    act(() => result.current.prefetchNext(WINDOW_MS * 0.75));
    await waitFor(() =>
      expect(
        h.fetchReplayEvents.mock.calls.some(([p]) => (p as { start: string }).start === toIso(START + WINDOW_MS)),
      ).toBe(true),
    );
  });

  it("快速连续 focusWindow：代次 last-wins，仅最后落点窗生效", async () => {
    h.fetchReplayEvents.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useReplayEvents({ startMs: START, endMs: null }));

    act(() => {
      result.current.focusWindow(0);
      result.current.focusWindow(2);
    });

    expect(result.current.focusedWindow).toBe(2);
    expect(
      h.fetchReplayEvents.mock.calls.some(([p]) => (p as { start: string }).start === toIso(START + 2 * WINDOW_MS)),
    ).toBe(true);
  });

  it("卸载时中止在途请求", async () => {
    h.fetchReplayEvents.mockImplementation(() => new Promise(() => {}));
    const { unmount } = renderHook(() => useReplayEvents({ startMs: START, endMs: null }));

    await waitFor(() => expect(h.fetchReplayEvents).toHaveBeenCalled());
    const signal = (h.fetchReplayEvents.mock.calls[0][0] as { signal: AbortSignal }).signal;

    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("startMs 为 null 时不发请求", async () => {
    renderHook(() => useReplayEvents({ startMs: null, endMs: null }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(h.fetchReplayEvents).not.toHaveBeenCalled();
  });
});
