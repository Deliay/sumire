import { beforeAll, describe, expect, it } from "vitest";
import {
  request,
  login,
  CookieJar,
  asSuperadmin,
  createRoleAccount,
  waitForReady,
  strongPassword,
} from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

const rand = () => `t_${Math.random().toString(36).slice(2, 10)}`;

describe("users list", () => {
  it("users-list-200: 超管 GET /api/users 返回含 username/role/createdAt 与 supersumire", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/users", { jar: sa });
    expect(res.status).toBe(200);
    const users = (res.body as { users: Array<Record<string, unknown>> }).users;
    expect(Array.isArray(users)).toBe(true);
    const row = users[0];
    expect(typeof row.username).toBe("string");
    expect(typeof row.role).toBe("string");
    expect(typeof row.createdAt).toBe("string");
    expect(users.some((u) => u.username === "supersumire")).toBe(true);
  });

  it("users-list-403: admin 与 member 登录后 GET /api/users 返回 403", async () => {
    const admin = await createRoleAccount("admin", `ad_${rand()}`, strongPassword);
    const member = await createRoleAccount("member", `mb_${rand()}`, strongPassword);
    const rAdmin = await request("/api/users", { jar: admin });
    const rMember = await request("/api/users", { jar: member });
    expect(rAdmin.status).toBe(403);
    expect(rMember.status).toBe(403);
  });

  it("users-list-401: 未登录 GET /api/users 返回 401", async () => {
    const res = await request("/api/users");
    expect(res.status).toBe(401);
  });
});

describe("create user", () => {
  it("create-user-superadmin: 超管可创建 member/admin/superadmin，均 201 且出现在列表", async () => {
    const sa = await asSuperadmin();
    const roles: Array<"member" | "admin" | "superadmin"> = ["member", "admin", "superadmin"];
    const created: string[] = [];
    for (const role of roles) {
      const username = `csa_${role}_${rand()}`;
      const res = await request("/api/users", {
        method: "POST",
        jar: sa,
        body: { username, password: strongPassword, role },
      });
      expect(res.status).toBe(201);
      const body = res.body as { ok: boolean; username: string; role: string };
      expect(body.ok).toBe(true);
      expect(body.role).toBe(role);
      created.push(username);
    }
    const list = await request("/api/users", { jar: sa });
    const users = (list.body as { users: Array<{ username: string }> }).users;
    for (const u of created) {
      expect(users.some((x) => x.username === u)).toBe(true);
    }
  });

  it("create-user-admin-member: admin 创建 member → 201", async () => {
    const admin = await createRoleAccount("admin", `adm_${rand()}`, strongPassword);
    const res = await request("/api/users", {
      method: "POST",
      jar: admin,
      body: { username: `mb_${rand()}`, password: strongPassword, role: "member" },
    });
    expect(res.status).toBe(201);
  });

  it("create-user-admin-403: admin 创建 admin/superadmin → 403", async () => {
    const admin = await createRoleAccount("admin", `adm_${rand()}`, strongPassword);
    const r1 = await request("/api/users", {
      method: "POST",
      jar: admin,
      body: { username: `a_${rand()}`, password: strongPassword, role: "admin" },
    });
    const r2 = await request("/api/users", {
      method: "POST",
      jar: admin,
      body: { username: `sa_${rand()}`, password: strongPassword, role: "superadmin" },
    });
    expect(r1.status).toBe(403);
    expect(r2.status).toBe(403);
  });

  it("create-user-member-403: member 创建任意角色 → 403", async () => {
    const member = await createRoleAccount("member", `mb_${rand()}`, strongPassword);
    const res = await request("/api/users", {
      method: "POST",
      jar: member,
      body: { username: `mb2_${rand()}`, password: strongPassword, role: "member" },
    });
    expect(res.status).toBe(403);
  });

  it("create-user-400: 角色枚举外 / 用户名为空 / 初始密码强度不达标 → 400", async () => {
    const sa = await asSuperadmin();
    const r1 = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username: `x_${rand()}`, password: strongPassword, role: "root" },
    });
    const r2 = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username: "", password: strongPassword, role: "member" },
    });
    const r3 = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username: `y_${rand()}`, password: "weak", role: "member" },
    });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(400);
  });

  it("create-user-409: 创建已存在用户名 → 409「用户名已存在」", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username: "supersumire", password: strongPassword, role: "member" },
    });
    expect(res.status).toBe(409);
    expect((res.body as { error?: string }).error).toBe("用户名已存在");
  });

  it("create-user-then-first-login: 新用户初始密码登录 → mustChangePassword=true", async () => {
    const username = `first_${rand()}`;
    const sa = await asSuperadmin();
    const create = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username, password: strongPassword, role: "member" },
    });
    expect(create.status).toBe(201);
    const jar = new CookieJar();
    const lr = await login(username, strongPassword, jar);
    expect(lr.status).toBe(200);
    expect((lr.body as { mustChangePassword: boolean }).mustChangePassword).toBe(true);
  });
});

describe("password-policy 在创建用户初始密码上复验", () => {
  it.each([
    "Ab1!@defg",
    "Abcdefghijk1234",
    "abcdefghijk!@",
    "123456789012!@",
  ])("初始密码 %s → 400", async (password) => {
    const sa = await asSuperadmin();
    const res = await request("/api/users", {
      method: "POST",
      jar: sa,
      body: { username: `pp_${rand()}`, password, role: "member" },
    });
    expect(res.status).toBe(400);
  });
});
