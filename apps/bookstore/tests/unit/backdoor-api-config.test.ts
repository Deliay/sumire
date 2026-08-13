import { describe, it, expect, vi, afterEach } from "vitest";

async function loadApi() {
  return await import("@/features/backdoor/api");
}

describe("API_CONFIGURED 单一事实源", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("NEXT_PUBLIC_API_BASE_URL 未配置（空）⇒ API_CONFIGURED === false", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const { API_CONFIGURED } = await loadApi();
    expect(API_CONFIGURED).toBe(false);
  });

  it("NEXT_PUBLIC_API_BASE_URL 已配置 ⇒ API_CONFIGURED === true", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    const { API_CONFIGURED } = await loadApi();
    expect(API_CONFIGURED).toBe(true);
  });
});
