import { describe, it, expect, vi, afterEach } from "vitest";

async function loadApi() {
  return await import("@/features/schedule/api");
}

describe("schedule api 未配置短路", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("未配置 NEXT_PUBLIC_API_BASE_URL 时不发起请求", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { listPlans, createPlan, updatePlan, deletePlan } = await loadApi();
    const list = await listPlans("2026-08-01", "2026-08-31");
    const create = await createPlan("2026-08-15", "20:00", "杂谈");
    const update = await updatePlan("id1", { date: "2026-08-16", startTime: "21:00", title: "歌杂" });
    const del = await deletePlan("id1");
    expect(list.status).toBe(0);
    expect(create.status).toBe(0);
    expect(update.status).toBe(0);
    expect(del.status).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("schedule api 请求路径", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("listPlans 携带 from/to query 参数", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify({ plans: [] }) }));
    vi.stubGlobal("fetch", fetchSpy);
    const { listPlans } = await loadApi();
    await listPlans("2026-08-01", "2026-08-31");
    const [url] = fetchSpy.mock.calls[0] as unknown as [string];
    expect(url).toContain("/api/stream-plans?");
    expect(url).toContain("from=2026-08-01");
    expect(url).toContain("to=2026-08-31");
  });

  it("createPlan 以 POST + JSON body 调用（含 startTime）", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 201,
      text: async () => JSON.stringify({ ok: true, id: "x", date: "2026-08-15", startTime: "20:00", title: "杂谈" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { createPlan } = await loadApi();
    const res = await createPlan("2026-08-15", "20:00", "杂谈");
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/stream-plans");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(String(opts.body))).toEqual({ date: "2026-08-15", startTime: "20:00", title: "杂谈" });
    expect(res.status).toBe(201);
  });

  it("updatePlan 以 PUT /api/stream-plans/{id} 调用", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      text: async () => JSON.stringify({ ok: true, id: "p1", date: "2026-08-16", startTime: "21:00", title: "歌杂" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { updatePlan } = await loadApi();
    const res = await updatePlan("p1", { date: "2026-08-16", startTime: "21:00", title: "歌杂" });
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/stream-plans/p1");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(String(opts.body))).toEqual({ date: "2026-08-16", startTime: "21:00", title: "歌杂" });
    expect(res.status).toBe(200);
  });

  it("deletePlan 以 DELETE /api/stream-plans/{id} 调用", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const fetchSpy = vi.fn(async () => ({ status: 200, text: async () => JSON.stringify({ ok: true }) }));
    vi.stubGlobal("fetch", fetchSpy);
    const { deletePlan } = await loadApi();
    const res = await deletePlan("p1");
    const [url, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/stream-plans/p1");
    expect(opts.method).toBe("DELETE");
    expect(res.status).toBe(200);
  });
});
