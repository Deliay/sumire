import { beforeAll, describe, expect, it } from "vitest";
import { request, login, CookieJar, waitForReady, strongPassword } from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

describe("session / me", () => {
  it("me-200: 登录后带 Cookie 返回 username/role/mustChangePassword", async () => {
    const jar = new CookieJar();
    await login("supersumire", "salamander", jar);
    const me = await request("/api/auth/me", { jar });
    expect(me.status).toBe(200);
    const body = me.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.username).toBe("supersumire");
    expect(body.role).toBe("superadmin");
    expect(typeof body.mustChangePassword).toBe("boolean");
  });

  it("me-401: 无 Cookie / 伪造 sid 均返回 401 + { error }", async () => {
    const r1 = await request("/api/auth/me");
    expect(r1.status).toBe(401);
    const forged = new CookieJar();
    forged.setSid("fake-session-123");
    const r2 = await request("/api/auth/me", { jar: forged });
    expect(r2.status).toBe(401);
  });

  it("me-flag: 初始密码登录 mustChangePassword=true；改密后为 false（用独立账号，不动种子）", async () => {
    const username = `flag_${Math.random().toString(36).slice(2, 8)}`;
    // 超管创建成员账号（初始密码即初始态）
    const sa = new CookieJar();
    await login("supersumire", "salamander", sa);
    await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username, password: strongPassword, role: "member" },
    });
    const jar = new CookieJar();
    await login(username, strongPassword, jar);
    const before = await request("/api/auth/me", { jar });
    expect((before.body as { mustChangePassword: boolean }).mustChangePassword).toBe(true);

    const cp = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: strongPassword, newPassword: strongPassword + "B2@" },
    });
    expect(cp.status).toBe(200);

    const after = await request("/api/auth/me", { jar });
    expect((after.body as { mustChangePassword: boolean }).mustChangePassword).toBe(false);
  });

  it("session-persist: 登录后间隔再次请求 me 连续 200（TTL 滑动刷新可用性）", async () => {
    const jar = new CookieJar();
    await login("supersumire", "salamander", jar);
    const m1 = await request("/api/auth/me", { jar });
    await new Promise((r) => setTimeout(r, 300));
    const m2 = await request("/api/auth/me", { jar });
    expect(m1.status).toBe(200);
    expect(m2.status).toBe(200);
  });

  it("multi-session: 同一凭据两次登录得两个会话，登出一个不影响另一个", async () => {
    const j1 = new CookieJar();
    const j2 = new CookieJar();
    await login("supersumire", "salamander", j1);
    await login("supersumire", "salamander", j2);
    expect(j1.cookieHeader).not.toBe(j2.cookieHeader);

    await request("/api/auth/logout", { method: "POST", jar: j1 });
    const me1 = await request("/api/auth/me", { jar: j1 });
    const me2 = await request("/api/auth/me", { jar: j2 });
    expect(me1.status).toBe(401);
    expect(me2.status).toBe(200);
  });
});
