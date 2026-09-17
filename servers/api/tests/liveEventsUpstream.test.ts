import { describe, it, expect, vi } from "vitest";
import { createLiveEventsUpstream, buildRangeUrl, buildSubscribeUrl } from "../src/liveEvents/upstream";

const BASE = "http://vtuber.internal.fffdan.com";

function jsonResponse(value: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => value } as unknown as Response;
}

function sseResponse(chunks: string[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok, status, body: stream } as unknown as Response;
}

describe("buildRangeUrl / buildSubscribeUrl", () => {
  it("base URL 拼接 /api/b/live/1727076670/event/range，多 type 重复参数 + 分页", () => {
    expect(buildRangeUrl(BASE, ["danmaku", "super_chat"], 2, 30)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=danmaku&type=super_chat&page=2&pageSize=30`,
    );
  });

  it("无 type 时不追加 type 参数（全部类型）", () => {
    expect(buildRangeUrl(BASE, [], 1, 50)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?page=1&pageSize=50`,
    );
  });

  it("subscribe 拼接 /event/subscribe 与多 type", () => {
    expect(buildSubscribeUrl(BASE, ["gift", "guard_buy"])).toBe(
      `${BASE}/api/b/live/1727076670/event/subscribe?type=gift&type=guard_buy`,
    );
  });

  it("base 带尾斜杠不双斜杠", () => {
    expect(buildRangeUrl(`${BASE}/`, ["danmaku"], 1, 50)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=danmaku&page=1&pageSize=50`,
    );
  });

  it("minPrice=5 时追加 minPrice=5", () => {
    expect(buildRangeUrl(BASE, ["gift"], 1, 50, 5)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=gift&page=1&pageSize=50&minPrice=5`,
    );
  });

  it("minPrice=0 时不追加 minPrice 参数", () => {
    expect(buildRangeUrl(BASE, ["gift"], 1, 50, 0)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=gift&page=1&pageSize=50`,
    );
  });

  it("minPrice=undefined 时不追加 minPrice 参数", () => {
    expect(buildRangeUrl(BASE, ["gift"], 1, 50)).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=gift&page=1&pageSize=50`,
    );
  });

  it("startedAt/endedAt 追加为上游时间过滤参数（非 start/end）", () => {
    const startedAt = "2026-08-25T02:50:53.000Z";
    const endedAt = "2026-08-25T02:54:53.000Z";
    const url = buildRangeUrl(BASE, ["danmaku"], 1, 100, undefined, startedAt, endedAt);
    expect(url).toBe(
      `${BASE}/api/b/live/1727076670/event/range?type=danmaku&page=1&pageSize=100&startedAt=${encodeURIComponent(
        startedAt,
      )}&endedAt=${encodeURIComponent(endedAt)}`,
    );
    expect(url).not.toContain("start=");
    expect(url).not.toContain("end=");
  });

  it("仅传 startedAt 支持开放端（不追加 endedAt）", () => {
    const startedAt = "2026-08-25T02:50:53.000Z";
    const url = buildRangeUrl(BASE, [], 1, 100, undefined, startedAt);
    expect(url).toContain(`startedAt=${encodeURIComponent(startedAt)}`);
    expect(url).not.toContain("endedAt=");
  });

  it("roomId 拼入上游路径段（非 1727076670）", () => {
    const url = buildRangeUrl(BASE, ["danmaku"], 1, 100, undefined, undefined, undefined, 12345);
    expect(url).toBe(`${BASE}/api/b/live/12345/event/range?type=danmaku&page=1&pageSize=100`);
  });

  it("roomId 与时间参数可同时拼接", () => {
    const startedAt = "2026-08-25T02:50:53.000Z";
    const url = buildRangeUrl(BASE, [], 1, 100, undefined, startedAt, undefined, 999);
    expect(url).toBe(
      `${BASE}/api/b/live/999/event/range?page=1&pageSize=100&startedAt=${encodeURIComponent(startedAt)}`,
    );
  });

  it("subscribe 支持 roomId 路径段", () => {
    expect(buildSubscribeUrl(BASE, ["gift"], 42)).toBe(
      `${BASE}/api/b/live/42/event/subscribe?type=gift`,
    );
  });

  it("非法 roomId（0/负数/小数）→ 抛错（防非法路径段）", () => {
    expect(() => buildRangeUrl(BASE, [], 1, 50, undefined, undefined, undefined, 0)).toThrow();
    expect(() => buildRangeUrl(BASE, [], 1, 50, undefined, undefined, undefined, -1)).toThrow();
    expect(() => buildRangeUrl(BASE, [], 1, 50, undefined, undefined, undefined, 1.5)).toThrow();
  });
});

describe("upstream.fetchRange", () => {
  it("返回分页信封 { total, page, pageSize, items }", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ total: 276, page: 1, pageSize: 50, items: [{ type: "super_chat" }] }),
    );
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const page = await upstream.fetchRange(["super_chat"], 1, 50);
    expect(page.total).toBe(276);
    expect(page.items).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE}/api/b/live/1727076670/event/range?type=super_chat&page=1&pageSize=50`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("startedAt/endedAt 透传到上游 URL", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ total: 745, page: 1, pageSize: 100, items: [] }),
    );
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const startedAt = "2026-08-25T02:50:53.000Z";
    const endedAt = "2026-08-25T02:54:53.000Z";
    const page = await upstream.fetchRange(["danmaku"], 1, 100, undefined, startedAt, endedAt);
    expect(page.total).toBe(745);
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE}/api/b/live/1727076670/event/range?type=danmaku&page=1&pageSize=100&startedAt=${encodeURIComponent(
        startedAt,
      )}&endedAt=${encodeURIComponent(endedAt)}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("roomId 透传到上游路径段", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ total: 3, page: 1, pageSize: 100, items: [] }),
    );
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const page = await upstream.fetchRange(["danmaku"], 1, 100, undefined, undefined, undefined, 12345);
    expect(page.total).toBe(3);
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE}/api/b/live/12345/event/range?type=danmaku&page=1&pageSize=100`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("不传 roomId 时回退默认枝堇房间", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ total: 0, page: 1, pageSize: 50, items: [] }),
    );
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    await upstream.fetchRange([], 1, 50);
    expect((fetchFn.mock.calls[0][0] as string).startsWith(`${BASE}/api/b/live/1727076670/`)).toBe(true);
  });

  it("上游 5xx → 抛错", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}, false, 502));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    await expect(upstream.fetchRange([], 1, 50)).rejects.toThrow();
  });

  it("响应非法（既非信封）→ 抛错", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ records: "nope" }));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    await expect(upstream.fetchRange([], 1, 50)).rejects.toThrow();
  });

  it("网络错误 → 抛错（由路由层兜 502）", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    await expect(upstream.fetchRange([], 1, 50)).rejects.toThrow("ECONNREFUSED");
  });
});

describe("upstream.subscribe（SSE 逐行解析）", () => {
  it("逐行解析 data: 帧并回调 JSON，跳过注释与空行", async () => {
    const events = [
      { type: "danmaku", occurredAt: "t1", payload: {} },
      { type: "gift", occurredAt: "t2", payload: {} },
    ];
    const body =
      `: ping\n\ndata: ${JSON.stringify(events[0])}\n\ndata: ${JSON.stringify(events[1])}\n\n`;
    const fetchFn = vi.fn().mockResolvedValue(sseResponse([body]));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const got: unknown[] = [];
    await upstream.subscribe([], (e) => void got.push(e), new AbortController().signal);
    expect(got).toEqual(events);
    expect(fetchFn).toHaveBeenCalledWith(
      `${BASE}/api/b/live/1727076670/event/subscribe`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("data 帧跨 chunk 边界也能完整解析", async () => {
    const line = `data: ${JSON.stringify({ type: "super_chat", payload: { id: 1 } })}\n\n`;
    const fetchFn = vi.fn().mockResolvedValue(sseResponse([line.slice(0, 10), line.slice(10)]));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const got: unknown[] = [];
    await upstream.subscribe([], (e) => void got.push(e), new AbortController().signal);
    expect(got).toEqual([{ type: "super_chat", payload: { id: 1 } }]);
  });

  it("非法 JSON 的 data 帧跳过并 warn，不中断", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = `data: {broken\n\ndata: {"type":"gift","payload":{}}\n\n`;
    const fetchFn = vi.fn().mockResolvedValue(sseResponse([body]));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const got: unknown[] = [];
    await upstream.subscribe([], (e) => void got.push(e), new AbortController().signal);
    expect(got).toEqual([{ type: "gift", payload: {} }]);
    expect(warn).toHaveBeenCalled();
  });

  it("上游非 200 → 抛错（路由层退避重连）", async () => {
    const fetchFn = vi.fn().mockResolvedValue(sseResponse([], false, 503));
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    await expect(
      upstream.subscribe([], () => {}, new AbortController().signal),
    ).rejects.toThrow();
  });

  it("AbortController 中止 → 停止读取（AbortError 安静退出）", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(`data: {"type":"gift","payload":{}}\n\n`));
      },
    });
    const fetchFn = vi.fn().mockImplementation(async (_url: string, init?: { signal?: AbortSignal }) => {
      init?.signal?.addEventListener("abort", () => controller.abort());
      return { ok: true, status: 200, body: stream } as unknown as Response;
    });
    const upstream = createLiveEventsUpstream(BASE, fetchFn as never);
    const got: unknown[] = [];
    const p = upstream.subscribe([], (e) => void got.push(e), controller.signal);
    // 等首帧被消费后再中止（read 与 abort 的竞态：先到的帧应已回调）
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(p).resolves.toBeUndefined();
    expect(got).toEqual([{ type: "gift", payload: {} }]);
  });
});
