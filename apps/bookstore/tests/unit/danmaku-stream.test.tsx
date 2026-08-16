// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

class MockEventSource {
  static CLOSED = 2;
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

const SC_EVENT = {
  eventId: "sc:1",
  type: "super_chat",
  occurredAt: "2026-08-16T12:00:00.000Z",
  sender: { uid: 100, name: "甲", face: null, medal: null },
  content: "加油",
  price: 30,
  read: false,
};

function makeScEvent(id: string) {
  return { ...SC_EVENT, eventId: id };
}

describe("useLiveEventStream", () => {
  afterEach(() => {
    MockEventSource.instances = [];
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadHook() {
    return await import("@/features/danmaku/useLiveEventStream");
  }

  it("未配置 API 基址时不建立连接", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubGlobal("EventSource", MockEventSource);
    const { useLiveEventStream } = await loadHook();
    const { result } = renderHook(() => useLiveEventStream(["danmaku"], vi.fn()));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe("idle");
  });

  it("以重复 type 参数 + withCredentials 连接 /api/live-events/stream", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    const { useLiveEventStream } = await loadHook();
    renderHook(() => useLiveEventStream(["super_chat", "guard_buy"], vi.fn()));
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain("http://localhost:4000/api/live-events/stream?");
    expect(es.url).toContain("type=super_chat");
    expect(es.url).toContain("type=guard_buy");
    expect(es.withCredentials).toBe(true);
  });

  it("onopen 后状态为 open，卸载时关闭连接", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    const { useLiveEventStream } = await loadHook();
    const { result, unmount } = renderHook(() => useLiveEventStream(["danmaku"], vi.fn()));
    expect(result.current.status).toBe("connecting");
    act(() => {
      MockEventSource.instances[0].onopen?.();
    });
    expect(result.current.status).toBe("open");
    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);
  });

  it("事件按 eventId 去重：相同 eventId 只分发一次", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    const { useLiveEventStream } = await loadHook();
    const onEvent = vi.fn();
    renderHook(() => useLiveEventStream(["super_chat"], onEvent));
    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeScEvent("sc:1"));
      es.emit(makeScEvent("sc:1"));
      es.emit(makeScEvent("sc:2"));
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[0][0].eventId).toBe("sc:1");
    expect(onEvent.mock.calls[1][0].eventId).toBe("sc:2");
  });

  it("非法帧（非 JSON / 不合 schema）被忽略", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    const { useLiveEventStream } = await loadHook();
    const onEvent = vi.fn();
    renderHook(() => useLiveEventStream(["super_chat"], onEvent));
    const es = MockEventSource.instances[0];
    act(() => {
      es.onmessage?.({ data: "not json" });
      es.onmessage?.({ data: JSON.stringify({ eventId: "x" }) });
      es.emit(makeScEvent("sc:9"));
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
