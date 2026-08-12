import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import { hashPassword } from "../src/auth/password";

function memSessionStore(): SessionStore {
  const map = new Map<string, { sid: string; data: unknown }>();
  return {
    async create(data) {
      const sid = `sid-${map.size + 1}-${Math.random().toString(36).slice(2)}`;
      map.set(sid, { sid, data });
      return sid;
    },
    async get(sid) {
      return (map.get(sid)?.data as never) ?? null;
    },
    async touch(sid, data) {
      if (map.has(sid)) map.set(sid, { sid, data });
    },
    async destroy(sid) {
      map.delete(sid);
    },
  };
}

const unlimited: RateLimiter = {
  async allow() {
    return true;
  },
  dispose() {},
};

/** 简单内存用户表，覆盖 users 路由所需的最小接口 */
const usersStore: Record<string, { username: string; passwordHash: string; role: string; mustChangePassword: boolean }> = {};

function toUserDoc(name: string): never {
  const u = usersStore[name];
  return {
    ...u,
    _id: { toString: () => `id-${name}` },
    createdAt: new Date(),
  } as never;
}

async function seedUsers() {
  usersStore["supersumire"] = {
    username: "supersumire",
    passwordHash: await hashPassword("salamander"),
    role: "superadmin",
    mustChangePassword: true,
  };
}

const dbModule = await import("../src/db/users");
vi.spyOn(dbModule, "findUserByUsername").mockImplementation(async (name: string) => {
  const u = usersStore[name];
  return u ? toUserDoc(name) : null;
});
vi.spyOn(dbModule, "updateUserPassword").mockImplementation(async (username: string, h: string) => {
  if (usersStore[username]) usersStore[username].passwordHash = h;
  usersStore[username].mustChangePassword = false;
});
vi.spyOn(dbModule, "createUser").mockImplementation(async (input: { username: string; passwordHash: string; role: string }) => {
  usersStore[input.username] = {
    username: input.username,
    passwordHash: input.passwordHash,
    role: input.role,
    mustChangePassword: true,
  };
  return toUserDoc(input.username);
});
vi.spyOn(dbModule, "listUsers").mockImplementation(async () =>
  Object.values(usersStore).map((u) => ({ username: u.username, role: u.role as never, createdAt: new Date() })),
);

async function call(app: ReturnType<typeof createApp>, req: {
  method: string;
  path: string;
  body?: unknown;
  cookie?: string;
  origin?: string;
}) {
  const headers: Record<string, string> = {};
  if (req.cookie) headers.cookie = req.cookie;
  if (req.origin) headers.origin = req.origin;
  const nodeReq = { method: req.method, url: req.path, headers, body: req.body, ip: "1.1.1.1" } as unknown as Request;
  return new Promise<{ status: number; body: unknown; cookie: string | undefined }>((resolve) => {
    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        res.headers[name] = value;
      }),
      headers: {} as Record<string, string>,
      statusCode: 0,
    };
    const nodeRes = {
      ...res,
      status(code: number) {
        res.statusCode = code;
        return nodeRes;
      },
      json(b: unknown) {
        resolve({ status: res.statusCode || 200, body: b, cookie: res.headers["Set-Cookie"] });
        return nodeRes;
      },
      setHeader: res.setHeader,
    } as unknown as Response;
    app(nodeReq, nodeRes, () => {});
  });
}

beforeEach(async () => {
  Object.keys(usersStore).forEach((k) => delete usersStore[k]);
  await seedUsers();
});

describe("auth 路由", () => {
  it("登录成功返回 200 + Set-Cookie", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire", password: "salamander" } });
    expect(r.status).toBe(200);
    expect(r.cookie).toContain("sumire_sid=");
  });

  it("密码错误 401，文案统一", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire", password: "wrong" } });
    expect(r.status).toBe(401);
    expect((r.body as { error: string }).error).toBe("账号或密码错误");
  });

  it("缺字段 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire" } });
    expect(r.status).toBe(400);
  });

  it("改密：newPassword 同 oldPassword → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const login = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire", password: "salamander" } });
    const r = await call(app, { method: "POST", path: "/api/auth/change-password", cookie: login.cookie, body: { oldPassword: "salamander", newPassword: "salamander" } });
    expect(r.status).toBe(400);
  });

  it("改密：oldPassword 错误 → 401", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const login = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire", password: "salamander" } });
    const r = await call(app, { method: "POST", path: "/api/auth/change-password", cookie: login.cookie, body: { oldPassword: "wrong", newPassword: "Abcdef12345!@#$%" } });
    expect(r.status).toBe(401);
  });

  it("改密成功 → 200 且清除强制标记", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const login = await call(app, { method: "POST", path: "/api/auth/login", body: { username: "supersumire", password: "salamander" } });
    const r = await call(app, { method: "POST", path: "/api/auth/change-password", cookie: login.cookie, body: { oldPassword: "salamander", newPassword: "Abcdef12345!@#$%" } });
    expect(r.status).toBe(200);
    expect(usersStore["supersumire"].mustChangePassword).toBe(false);
  });
});

describe("users 路由", () => {
  async function login(app: ReturnType<typeof createApp>, username: string, password: string) {
    const r = await call(app, { method: "POST", path: "/api/auth/login", body: { username, password } });
    return r.cookie;
  }

  it("未登录 GET /api/users → 401", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/users" });
    expect(r.status).toBe(401);
  });

  it("admin 登录 GET /api/users → 403", async () => {
    usersStore["admin1"] = { username: "admin1", passwordHash: await hashPassword("Admin1abc123!@#$%"), role: "admin", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "admin1", "Admin1abc123!@#$%");
    const r = await call(app, { method: "GET", path: "/api/users", cookie: sid });
    expect(r.status).toBe(403);
  });

  it("superadmin 创建 member → 201", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "m1", password: "Member1abc123!@#$", role: "member" } });
    expect(r.status).toBe(201);
  });

  it("superadmin 创建 superadmin → 201", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "sa2", password: "Super1abc123!@#$", role: "superadmin" } });
    expect(r.status).toBe(201);
  });

  it("admin 创建 admin → 403", async () => {
    usersStore["admin1"] = { username: "admin1", passwordHash: await hashPassword("Admin1abc123!@#$%"), role: "admin", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "admin1", "Admin1abc123!@#$%");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "a2", password: "Admin2abc123!@#$%", role: "admin" } });
    expect(r.status).toBe(403);
  });

  it("member 创建任意角色 → 403", async () => {
    usersStore["member1"] = { username: "member1", passwordHash: await hashPassword("Member1abc123!@#$"), role: "member", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "member1", "Member1abc123!@#$");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "m2", password: "Member2abc123!@#$", role: "member" } });
    expect(r.status).toBe(403);
  });

  it("创建已存在用户名 → 409", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "supersumire", password: "Abcdef12345!@#$%", role: "member" } });
    expect(r.status).toBe(409);
  });

  it("角色非法 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "m2", password: "Abcdef12345!@#$%", role: "root" } });
    expect(r.status).toBe(400);
  });

  it("初始密码强度不达标 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/users", cookie: sid, body: { username: "m2", password: "weak", role: "member" } });
    expect(r.status).toBe(400);
  });
});
