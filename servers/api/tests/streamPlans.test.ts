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
  async isBlocked() {
    return false;
  },
  async recordFailure() {},
  dispose() {},
};

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

// ---------- stream plans 内存库 ----------
interface Row {
  id: string;
  date: string;
  title: string;
  createdBy: string;
  createdAt: Date;
}
let plansStore: Row[] = [];
let seq = 0;

const dbModule = await import("../src/db/users");
vi.spyOn(dbModule, "findUserByUsername").mockImplementation(async (name: string) => {
  const u = usersStore[name];
  return u ? toUserDoc(name) : null;
});

const spModule = await import("../src/db/streamPlans");
vi.spyOn(spModule, "createStreamPlan").mockImplementation(async (input: { date: string; title: string; createdBy: string }) => {
  const row: Row = { id: `sp-${++seq}`, date: input.date, title: input.title, createdBy: input.createdBy, createdAt: new Date() };
  plansStore.push(row);
  return { id: row.id, date: row.date, title: row.title, createdAt: row.createdAt };
});
vi.spyOn(spModule, "findStreamPlan").mockImplementation(async (date: string, title: string) => {
  const hit = plansStore.find((r) => r.date === date && r.title === title);
  return hit ? { ...hit, _id: { toString: () => hit.id } } : null;
});
vi.spyOn(spModule, "listStreamPlans").mockImplementation(async (from?: string, to?: string) => {
  return plansStore
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
    .map((r) => ({ id: r.id, date: r.date, title: r.title, createdAt: r.createdAt }));
});

async function call(app: ReturnType<typeof createApp>, req: {
  method: string;
  path: string;
  body?: unknown;
  cookie?: string;
}) {
  const headers: Record<string, string> = {};
  if (req.cookie) headers.cookie = req.cookie;
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

async function login(app: ReturnType<typeof createApp>, username: string, password: string) {
  const r = await call(app, { method: "POST", path: "/api/auth/login", body: { username, password } });
  return r.cookie;
}

beforeEach(async () => {
  Object.keys(usersStore).forEach((k) => delete usersStore[k]);
  plansStore = [];
  seq = 0;
  await seedUsers();
});

describe("GET /api/stream-plans（公开读）", () => {
  it("未登录可读，空库返回空数组", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/stream-plans" });
    expect(r.status).toBe(200);
    expect((r.body as { plans: unknown[] }).plans).toEqual([]);
  });

  it("按 from/to 区间过滤且按日期升序", async () => {
    plansStore.push(
      { id: "1", date: "2026-08-10", title: "早场", createdBy: "a", createdAt: new Date() },
      { id: "2", date: "2026-08-15", title: "杂谈", createdBy: "a", createdAt: new Date() },
      { id: "3", date: "2026-08-20", title: "歌回", createdBy: "a", createdAt: new Date() },
    );
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/stream-plans?from=2026-08-12&to=2026-08-18" });
    expect(r.status).toBe(200);
    const plans = (r.body as { plans: Array<{ date: string }> }).plans;
    expect(plans.map((p) => p.date)).toEqual(["2026-08-15"]);
  });

  it("日期参数非法 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/stream-plans?from=2026/08/15" });
    expect(r.status).toBe(400);
  });
});

describe("POST /api/stream-plans（受限写）", () => {
  it("未登录 → 401", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "POST", path: "/api/stream-plans", body: { date: "2026-08-15", title: "杂谈" } });
    expect(r.status).toBe(401);
  });

  it("member 登录 → 403", async () => {
    usersStore["member1"] = { username: "member1", passwordHash: await hashPassword("Member1abc123!@#$"), role: "member", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "member1", "Member1abc123!@#$");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "杂谈" } });
    expect(r.status).toBe(403);
  });

  it("admin 登录创建 → 201", async () => {
    usersStore["admin1"] = { username: "admin1", passwordHash: await hashPassword("Admin1abc123!@#$%"), role: "admin", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "admin1", "Admin1abc123!@#$%");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "杂谈" } });
    expect(r.status).toBe(201);
    const b = r.body as { ok: boolean; id: string; date: string; title: string };
    expect(b.ok).toBe(true);
    expect(b.date).toBe("2026-08-15");
    expect(b.title).toBe("杂谈");
  });

  it("日期格式非法 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-02-30", title: "杂谈" } });
    expect(r.status).toBe(400);
  });

  it("主题为空 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "   " } });
    expect(r.status).toBe(400);
  });

  it("主题超 50 字符 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "x".repeat(51) } });
    expect(r.status).toBe(400);
  });

  it("同日同主题 → 409", async () => {
    plansStore.push({ id: "1", date: "2026-08-15", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "杂谈" } });
    expect(r.status).toBe(409);
  });
});
