// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDanmakuSearch } from "../../features/danmaku/search/useDanmakuSearch";
import type { LiveEvent } from "../../features/danmaku/types";

vi.mock("../../features/danmaku/search/api", () => ({
  searchLiveEvents: vi.fn(),
}));

import { searchLiveEvents } from "../../features/danmaku/search/api";

const mockSearchLiveEvents = vi.mocked(searchLiveEvents);

function makeEvent(id: string): LiveEvent {
  return {
    eventId: id,
    type: "danmaku",
    occurredAt: new Date().toISOString(),
    sender: { uid: 1, name: "test", nameRomaji: null, face: null, medal: null, guardLevel: null },
    content: id,
    read: false,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockSearchLiveEvents.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDanmakuSearch", () => {
  it("初始状态：idle，results 为空", () => {
    const { result } = renderHook(() => useDanmakuSearch());
    expect(result.current.status).toBe("idle");
    expect(result.current.results).toEqual([]);
    expect(result.current.input).toBe("");
    expect(result.current.criteria).toBe("");
  });

  it("输入变化触发防抖搜索", async () => {
    mockSearchLiveEvents.mockResolvedValue({
      status: 200,
      data: { total: 1, page: 1, pageSize: 20, items: [makeEvent("dm:1")] },
    });

    const { result } = renderHook(() => useDanmakuSearch());

    act(() => {
      result.current.updateInput("test");
    });
    expect(mockSearchLiveEvents).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchLiveEvents).toHaveBeenCalledOnce();
    expect(mockSearchLiveEvents).toHaveBeenCalledWith("test", 1, 20, expect.any(AbortSignal));
  });

  it("回车立即 flush 搜索", async () => {
    mockSearchLiveEvents.mockResolvedValue({
      status: 200,
      data: { total: 0, page: 1, pageSize: 20, items: [] },
    });

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });
    act(() => { result.current.flushSearch(); });

    expect(mockSearchLiveEvents).toHaveBeenCalledOnce();
    expect(mockSearchLiveEvents).toHaveBeenCalledWith("test", 1, 20, expect.any(AbortSignal));
  });

  it("清空输入重置状态", async () => {
    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });
    act(() => { vi.advanceTimersByTime(300); });
    act(() => { result.current.updateInput(""); });

    expect(result.current.status).toBe("idle");
    expect(result.current.results).toEqual([]);
    expect(result.current.criteria).toBe("");
  });

  it("搜索成功后 status=done", async () => {
    mockSearchLiveEvents.mockImplementation(async () => ({
      status: 200,
      data: { total: 5, page: 1, pageSize: 20, items: [makeEvent("dm:1")] },
    }));

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.status).toBe("done");
    expect(result.current.results).toHaveLength(1);
    expect(result.current.total).toBe(5);
  });

  it("零结果搜索 status=done（非 idle）", async () => {
    mockSearchLiveEvents.mockImplementation(async () => ({
      status: 200,
      data: { total: 0, page: 1, pageSize: 20, items: [] },
    }));

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.status).toBe("done");
    expect(result.current.results).toEqual([]);
  });

  it("搜索失败设置 status=error", async () => {
    mockSearchLiveEvents.mockImplementation(async () => ({
      status: 502,
      data: { error: "上游事件服务不可用" },
    }));

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("搜索服务不可用");
  });

  it("loadMore 追加结果", async () => {
    mockSearchLiveEvents
      .mockImplementationOnce(async () => ({
        status: 200,
        data: { total: 3, page: 1, pageSize: 20, items: [makeEvent("dm:1"), makeEvent("dm:2")] },
      }))
      .mockImplementationOnce(async () => ({
        status: 200,
        data: { total: 3, page: 2, pageSize: 20, items: [makeEvent("dm:3")] },
      }));

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.results).toHaveLength(2);

    await act(async () => {
      result.current.loadMore();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.results).toHaveLength(3);
    expect(result.current.results.map((e) => e.eventId)).toEqual(["dm:1", "dm:2", "dm:3"]);
  });

  it("追加失败保留已有结果，记录 failedPage", async () => {
    mockSearchLiveEvents
      .mockImplementationOnce(async () => ({
        status: 200,
        data: { total: 3, page: 1, pageSize: 20, items: [makeEvent("dm:1")] },
      }))
      .mockImplementationOnce(async () => ({
        status: 502,
        data: { error: "上游事件服务不可用" },
      }));

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("test"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.results).toHaveLength(1);

    await act(async () => {
      result.current.loadMore();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.failedPage).toBe(2);
    expect(result.current.error).toBe("搜索服务不可用");
  });

  it("新搜索失败时不残留旧结果，status=error", async () => {
    // 第一次搜索成功
    mockSearchLiveEvents.mockResolvedValueOnce({
      status: 200,
      data: { total: 3, page: 1, pageSize: 20, items: [makeEvent("dm:1"), makeEvent("dm:2")] },
    });

    const { result } = renderHook(() => useDanmakuSearch());
    act(() => { result.current.updateInput("A"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.results).toHaveLength(2);
    expect(result.current.status).toBe("done");

    // 第二次搜索失败
    mockSearchLiveEvents.mockResolvedValueOnce({
      status: 502,
      data: { error: "上游事件服务不可用" },
    });

    act(() => { result.current.updateInput("B"); });

    await act(async () => {
      result.current.flushSearch();
      await new Promise((r) => setTimeout(r, 0));
    });

    // 旧结果不应残留，应显示错误态
    expect(result.current.status).toBe("error");
    expect(result.current.results).toHaveLength(0);
    expect(result.current.error).toBe("搜索服务不可用");
    expect(result.current.failedPage).toBeNull();
  });
});
