import { describe, it, expect, vi, afterEach } from "vitest";

/** 以指定基址重新加载模块（模块级读取 env，需 resetModules）。 */
async function loadModule(base: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", base);
  return await import("@/features/recordings/replay/replayEvents");
}

const rawItem = {
  eventId: "dm:1",
  type: "danmaku",
  occurredAt: "2026-09-17T10:00:01.000Z",
  sender: { uid: 7, name: "观众", face: null, medal: null },
  content: "来了来了",
};

function okResponse(body: unknown) {
  return { status: 200, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchReplayEvents 基址与 URL 拼装", () => {
  it("基址取 NEXT_PUBLIC_API_BASE_URL，路径为 /api/live-events/replay", async () => {
    const mod = await loadModule("https://api.example.com/");
    const spy = vi.fn().mockResolvedValue(okResponse({ total: 0, page: 1, pageSize: 100, items: [] }));
    vi.stubGlobal("fetch", spy);

    await mod.fetchReplayEvents({ start: "2026-09-17T10:00:00.000Z", end: "2026-09-17T10:10:00.000Z" });

    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe("https://api.example.com/api/live-events/replay");
    expect(url.searchParams.get("start")).toBe("2026-09-17T10:00:00.000Z");
    expect(url.searchParams.get("end")).toBe("2026-09-17T10:10:00.000Z");
  });

  it("type 以重复查询参数传递、分页参数显式拼入", async () => {
    const mod = await loadModule("https://api.example.com");
    const spy = vi.fn().mockResolvedValue(okResponse({ total: 0, page: 1, pageSize: 100, items: [] }));
    vi.stubGlobal("fetch", spy);

    await mod.fetchReplayEvents({
      start: "a",
      end: "b",
      types: ["danmaku", "gift"],
      page: 2,
      pageSize: 50,
    });

    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.searchParams.getAll("type")).toEqual(["danmaku", "gift"]);
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("50");
  });

  it("不携带凭据（fetch 选项无 credentials）", async () => {
    const mod = await loadModule("https://api.example.com");
    const spy = vi.fn().mockResolvedValue(okResponse({ total: 0, page: 1, pageSize: 100, items: [] }));
    vi.stubGlobal("fetch", spy);

    await mod.fetchReplayEvents({ start: "a", end: "b" });

    const options = spy.mock.calls[0][1] as RequestInit | undefined;
    expect(options?.credentials).toBeUndefined();
  });

  it("未配置基址：短路不 fetch，返回降级值", async () => {
    const mod = await loadModule("");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    const res = await mod.fetchReplayEvents({ start: "a", end: "b" });
    expect(res).toEqual({ ok: false, total: 0, items: [] });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("fetchReplayEvents 解析与降级", () => {
  it("解析成功后为每条事件补 read:false，并补齐缺失的可选 sender 字段", async () => {
    const mod = await loadModule("https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ total: 1, page: 1, pageSize: 100, items: [rawItem] })));

    const res = await mod.fetchReplayEvents({ start: "a", end: "b" });
    expect(res.ok).toBe(true);
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].read).toBe(false);
    expect(res.items[0].sender.nameRomaji).toBeNull();
    expect(res.items[0].sender.guardLevel ?? null).toBeNull();
    expect(res.items[0].content).toBe("来了来了");
  });

  it("非 200 静默降级", async () => {
    const mod = await loadModule("https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 502, json: async () => ({}) } as unknown as Response));
    expect(await mod.fetchReplayEvents({ start: "a", end: "b" })).toEqual({ ok: false, total: 0, items: [] });
  });

  it("fetch reject 静默降级", async () => {
    const mod = await loadModule("https://api.example.com");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await mod.fetchReplayEvents({ start: "a", end: "b" })).toEqual({ ok: false, total: 0, items: [] });
  });

  it("非法 JSON 静默降级", async () => {
    const mod = await loadModule("https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      } as unknown as Response),
    );
    expect(await mod.fetchReplayEvents({ start: "a", end: "b" })).toEqual({ ok: false, total: 0, items: [] });
  });

  it("无法通过 schema 的条目被丢弃，其余保留", async () => {
    const mod = await loadModule("https://api.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okResponse({ total: 2, page: 1, pageSize: 100, items: [rawItem, { bad: true }] })),
    );
    const res = await mod.fetchReplayEvents({ start: "a", end: "b" });
    expect(res.ok).toBe(true);
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(1);
  });
});
