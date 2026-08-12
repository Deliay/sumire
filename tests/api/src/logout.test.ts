import { beforeAll, describe, expect, it } from "vitest";
import { request, login, CookieJar, waitForReady } from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

describe("logout", () => {
  it("logout-200: 登录后登出，Set-Cookie 使 sumire_sid 过期，后续 me 401", async () => {
    const jar = new CookieJar();
    await login("supersumire", "salamander", jar);
    const out = await request("/api/auth/logout", { method: "POST", jar });
    expect(out.status).toBe(200);
    expect((out.body as { ok?: boolean }).ok).toBe(true);
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");
    const me = await request("/api/auth/me", { jar });
    expect(me.status).toBe(401);
  });

  it("logout-idempotent: 未登录直接登出返回 200（幂等）", async () => {
    const res = await request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect((res.body as { ok?: boolean }).ok).toBe(true);
  });
});
