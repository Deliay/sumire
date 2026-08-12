import { beforeAll, describe, expect, it } from "vitest";
import { request, login, CookieJar, waitForReady } from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

describe("login", () => {
  it("login-200: 正确凭据返回 200 + Set-Cookie sumire_sid", async () => {
    const jar = new CookieJar();
    const res = await login("supersumire", "salamander", jar);
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.username).toBe("supersumire");
    expect(body.role).toBe("superadmin");
    expect(typeof body.mustChangePassword).toBe("boolean");
    expect(res.headers.get("set-cookie")).toContain("sumire_sid=");
  });

  it("cookie-attributes: Set-Cookie 含 HttpOnly/Path=/SameSite=Lax/Max-Age=604800，不含 Domain", async () => {
    const jar = new CookieJar();
    const res = await login("supersumire", "salamander", jar);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toContain("Domain");
  });

  it("login-401: 错误密码与不存在用户均 401 且文案一致", async () => {
    const r1 = await login("supersumire", "wrong-password");
    const r2 = await login("no-such-user-xyz", "whatever");
    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    const e1 = (r1.body as { error?: string }).error;
    const e2 = (r2.body as { error?: string }).error;
    expect(e1).toBe("账号或密码错误");
    expect(e2).toBe(e1);
    expect(r1.headers.get("set-cookie")).toBeNull();
  });

  it("login-400: 缺 username 或 password 字段返回 4xx + { error }", async () => {
    const r1 = await request("/api/auth/login", { method: "POST", body: { username: "supersumire" } });
    const r2 = await request("/api/auth/login", { method: "POST", body: { password: "x" } });
    expect(r1.status).toBeGreaterThanOrEqual(400);
    expect(r2.status).toBeGreaterThanOrEqual(400);
    expect(typeof (r1.body as { error?: string }).error).toBe("string");
  });

  it("no-register-route: 契约外注册路由返回 404", async () => {
    const res = await request("/api/auth/register", { method: "POST", body: {} });
    expect(res.status).toBe(404);
  });
});
