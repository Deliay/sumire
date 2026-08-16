import { describe, it, expect, vi, afterEach } from "vitest";

const INTERNAL_BASE_URL = "http://vtuber.internal.fffdan.com";

describe("config.liveEventsUpstreamUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("未设置 LIVE_EVENTS_UPSTREAM_URL 时回退内网 base URL（不抛错）", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_EVENTS_UPSTREAM_URL", "");
    const { config } = await import("../src/config");
    expect(config.liveEventsUpstreamUrl).toBe(INTERNAL_BASE_URL);
  });

  it("已设置时取环境变量值", async () => {
    vi.resetModules();
    vi.stubEnv("LIVE_EVENTS_UPSTREAM_URL", "http://127.0.0.1:9877");
    const { config } = await import("../src/config");
    expect(config.liveEventsUpstreamUrl).toBe("http://127.0.0.1:9877");
  });
});
