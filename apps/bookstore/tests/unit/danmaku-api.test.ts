import { describe, it, expect, vi, afterEach } from "vitest";

async function loadApi() {
  return await import("@/features/danmaku/api");
}

describe("danmaku api 未配置短路", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("未配置 NEXT_PUBLIC_API_BASE_URL 时不发起请求", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { listLiveEvents, markLiveEventRead, markLiveEventUnread, markAllLiveEventsRead } =
      await loadApi();
    const list = await listLiveEvents(["danmaku"]);
    const read = await markLiveEventRead("sc:1");
    const unread = await markLiveEventUnread("sc:1");
    const readAll = await markAllLiveEventsRead("super_chat");
    expect(list.status).toBe(0);
    expect(read.status).toBe(0);
    expect(unread.status).toBe(0);
    expect(readAll.status).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("danmaku api 请求路径", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("listLiveEvents 以重复 type 参数 + 分页查询", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ total: 0, page: 2, pageSize: 30, items: [] }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { listLiveEvents } = await loadApi();
    const res = await listLiveEvents(["gift", "guard_buy"], 2, 30);
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/live-events?");
    expect(url).toContain("type=gift");
    expect(url).toContain("type=guard_buy");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=30");
    expect(opts.credentials).toBe("include");
    expect(res.status).toBe(200);
  });

  it("listLiveEvents 缺省分页参数", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ total: 0, page: 1, pageSize: 50, items: [] }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { listLiveEvents } = await loadApi();
    await listLiveEvents(["super_chat"]);
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=50");
  });

  it("markLiveEventRead / markLiveEventUnread 以 POST + JSON body 调用", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { markLiveEventRead, markLiveEventUnread } = await loadApi();
    await markLiveEventRead("sc:42");
    await markLiveEventUnread("guard:7:123");
    const [readUrl, readOpts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const [unreadUrl, unreadOpts] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
    expect(readUrl).toContain("/api/live-events/read");
    expect(readOpts.method).toBe("POST");
    expect(JSON.parse(String(readOpts.body))).toEqual({ eventId: "sc:42" });
    expect(readOpts.credentials).toBe("include");
    expect(unreadUrl).toContain("/api/live-events/unread");
    expect(JSON.parse(String(unreadOpts.body))).toEqual({ eventId: "guard:7:123" });
  });

  it("markAllLiveEventsRead 以 POST + type body 调用", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ ok: true, marked: 12 }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { markAllLiveEventsRead } = await loadApi();
    const res = await markAllLiveEventsRead("guard_buy");
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/live-events/read-all");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(String(opts.body))).toEqual({ type: "guard_buy" });
    expect(res.status).toBe(200);
    if (res.status === 200 && "marked" in res.data) {
      expect(res.data.marked).toBe(12);
    }
  });
});
