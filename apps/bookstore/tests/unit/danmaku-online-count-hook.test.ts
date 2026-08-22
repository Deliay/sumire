// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

let currentApiConfigured = true;
let fetchCalls: { url: string; opts: RequestInit }[] = [];
let fetchHandler: ((url: string, opts: RequestInit) => Promise<Response>) | null = null;
let fetchResolvers: ((value: void) => void)[] = [];

vi.mock("@/features/backdoor/api", () => ({
  get API_BASE_URL() {
    return currentApiConfigured ? "http://localhost:4000" : "";
  },
  get API_CONFIGURED() {
    return currentApiConfigured;
  },
  request: async <T>(path: string, options: { signal?: AbortSignal } = {}) => {
    fetchCalls.push({ url: path, opts: { signal: options.signal } as RequestInit });
    if (!currentApiConfigured) {
      return { status: 0, data: null as unknown as T };
    }
    if (fetchHandler) {
      const res = await fetchHandler(path, { signal: options.signal } as RequestInit);
      const text = await res.text();
      const result = { status: res.status, data: JSON.parse(text) as T };
      fetchResolvers.forEach((r) => r());
      fetchResolvers = [];
      return result;
    }
    return { status: 200, data: { items: [] } as unknown as T };
  },
}));

async function loadHook() {
  return await import("@/features/danmaku/useOnlineCount");
}

function waitForFetch() {
  return new Promise<void>((resolve) => {
    fetchResolvers.push(resolve);
  });
}

describe("useOnlineCount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentApiConfigured = true;
    fetchCalls = [];
    fetchHandler = null;
    fetchResolvers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("未配置 API 时恒返回 null 且不发请求", async () => {
    currentApiConfigured = false;
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    expect(result.current.onlineCount).toBeNull();
    expect(fetchCalls).toHaveLength(0);
  });

  it("挂载首取返回含 payload.data.online_count 的 items → 数值就绪", async () => {
    fetchHandler = async () =>
      new Response(JSON.stringify({ items: [{ payload: { data: { online_count: 1521 } } }] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBe(1521);
  });

  it("items 为空 → null", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ items: [] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBeNull();
  });

  it("online_count 缺失 → null", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ items: [{}] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBeNull();
  });

  it("online_count 为非有限数字（NaN、Infinity）→ null", async () => {
    fetchHandler = async () =>
      new Response(JSON.stringify({ items: [{ payload: { online_count: NaN } }] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBeNull();
  });

  it("请求非 200（401/502）→ null", async () => {
    fetchHandler = async () => new Response("{}", { status: 401 });
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBeNull();
  });

  it("已有值时请求失败 → 保留最后成功值", async () => {
    let callCount = 0;
    fetchHandler = async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ items: [{ payload: { data: { online_count: 100 } } }] }));
      }
      return new Response("{}", { status: 500 });
    };
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBe(100);

    // 首取兜底不触发二次 GET，所以 fetchCalls 不增加
    const callsBefore = fetchCalls.length;
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(fetchCalls.length).toBe(callsBefore);
    expect(result.current.onlineCount).toBe(100);
  });

  it("SSE 命名帧直接更新数值（不产生 GET）", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ items: [] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBeNull();

    const fetchCountBefore = fetchCalls.length;

    act(() => {
      result.current.onOnlineCount({ payload: { data: { online_count: 2048 } } });
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBe(2048);
    // 不应产生新的 GET 请求
    expect(fetchCalls.length).toBe(fetchCountBefore);
  });

  it("5s leading+trailing 节流：间隔内多个帧只产生 leading 一次 + trailing 一次", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ items: [] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    let fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));

    // 等待首取节流窗口过期
    await act(() => vi.advanceTimersByTimeAsync(5000));

    // 第一个帧：leading 立即更新
    act(() => {
      result.current.onOnlineCount({ payload: { data: { online_count: 100 } } });
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.onlineCount).toBe(100);

    // 间隔内多个帧：只记录最新值，不立即更新
    act(() => {
      result.current.onOnlineCount({ payload: { data: { online_count: 200 } } });
      result.current.onOnlineCount({ payload: { data: { online_count: 300 } } });
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    // leading 已更新为 100，后续帧在节流窗口内
    expect(result.current.onlineCount).toBe(100);

    // trailing 定时器触发，使用最新值
    fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.onlineCount).toBe(300);
  });

  it("帧 payload 脏数据（缺失/非有限数字）被忽略", async () => {
    fetchHandler = async () => new Response(JSON.stringify({ items: [] }));
    const { useOnlineCount } = await loadHook();
    const { result } = renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));

    await act(() => vi.advanceTimersByTimeAsync(5000));

    act(() => {
      result.current.onOnlineCount({ payload: { data: { online_count: NaN } } });
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.onlineCount).toBeNull();

    act(() => {
      result.current.onOnlineCount({});
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.onlineCount).toBeNull();

    act(() => {
      result.current.onOnlineCount({ payload: {} });
    });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(result.current.onlineCount).toBeNull();
  });

  it("卸载后不再发请求亦不更新", async () => {
    fetchHandler = async () =>
      new Response(JSON.stringify({ items: [{ payload: { data: { online_count: 100 } } }] }));
    const { useOnlineCount } = await loadHook();
    const { result, unmount } = renderHook(() => useOnlineCount());
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(result.current.onlineCount).toBe(100);

    unmount();
    const callsBefore = fetchCalls.length;
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(fetchCalls.length).toBe(callsBefore);
  });

  it("首取至多 1 次 GET（刷新不重复）", async () => {
    fetchHandler = async () =>
      new Response(JSON.stringify({ items: [{ payload: { online_count: 1521 } }] }));
    const { useOnlineCount } = await loadHook();
    renderHook(() => useOnlineCount());
    const fetchPromise = waitForFetch();
    await act(() => vi.advanceTimersByTimeAsync(100));
    await fetchPromise;
    await act(() => vi.advanceTimersByTimeAsync(0));

    const fetchCount = fetchCalls.length;
    expect(fetchCount).toBe(1);

    // 模拟长时间运行，不应有新的 GET
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(fetchCalls.length).toBe(fetchCount);
  });
});
