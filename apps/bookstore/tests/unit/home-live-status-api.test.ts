// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_BASE_URL() {
    return "https://api.example";
  },
  get API_CONFIGURED() {
    return configured;
  },
}));

async function load() {
  return import("@/features/home/api");
}

describe("getLiveStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    configured = true;
    vi.resetModules();
  });

  it("API_CONFIGURED=false 时短路返回降级体", async () => {
    configured = false;
    vi.resetModules();
    const { getLiveStatus } = await load();
    await expect(getLiveStatus()).resolves.toEqual({ ok: false, status: null });
  });

  it("200 正常体透传", async () => {
    const { getLiveStatus } = await load();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({ ok: true, status: { live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" } }),
      }),
    );
    await expect(getLiveStatus()).resolves.toEqual({
      ok: true,
      status: { live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" },
    });
  });

  it("非 2xx 静默降级", async () => {
    const { getLiveStatus } = await load();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        json: async () => ({ error: "x" }),
      }),
    );
    await expect(getLiveStatus()).resolves.toEqual({ ok: false, status: null });
  });

  it("请求异常静默降级", async () => {
    const { getLiveStatus } = await load();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(getLiveStatus()).resolves.toEqual({ ok: false, status: null });
  });
});