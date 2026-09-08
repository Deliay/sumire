import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { createApp } from "../src/app";
import type { SessionStore } from "../src/session/store";
import type { RateLimiter } from "../src/auth/rateLimit";
import { hashPassword } from "../src/auth/password";
import { isValidTime } from "../src/routes/streamPlans";
import type { TimeType } from "../src/db/streamPlans";

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
  timeType: TimeType;
  startTime: string | null;
  title: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}
let plansStore: Row[] = [];
let seq = 0;

/** 生成确定性的合法 ObjectId（24 位十六进制）。 */
function oid(seed: string): string {
  const hex = seed.split("").map((c) => c.charCodeAt(0).toString(16)).join("");
  return (hex + "0".repeat(24)).slice(0, 24);
}

const dbModule = await import("../src/db/users");
vi.spyOn(dbModule, "findUserByUsername").mockImplementation(async (name: string) => {
  const u = usersStore[name];
  return u ? toUserDoc(name) : null;
});

const spModule = await import("../src/db/streamPlans");
vi.spyOn(spModule, "createStreamPlan").mockImplementation(async (input: { date: string; timeType: TimeType; startTime: string | null; title: string; createdBy: string }) => {
  const startTime = input.timeType === "fixed" ? input.startTime : null;
  const row: Row = { id: oid(`sp-${++seq}`), date: input.date, timeType: input.timeType, startTime, title: input.title, createdBy: input.createdBy, createdAt: new Date() };
  plansStore.push(row);
  return { id: row.id, date: row.date, timeType: row.timeType, startTime: row.startTime, title: row.title, createdAt: row.createdAt };
});
vi.spyOn(spModule, "findStreamPlan").mockImplementation(async (date: string, timeType: TimeType, startTime: string | null, title: string, excludeId?: string) => {
  const hit = plansStore.find((r) => r.date === date && r.timeType === timeType && r.startTime === (startTime ?? null) && r.title === title && r.id !== excludeId);
  if (!hit) return null;
  return { ...hit, _id: { toString: () => hit.id } } as never;
});
vi.spyOn(spModule, "updateStreamPlan").mockImplementation(async (id: string, input: { date: string; timeType: TimeType; startTime: string | null; title: string }) => {
  const row = plansStore.find((r) => r.id === id);
  if (!row) return null;
  row.date = input.date;
  row.timeType = input.timeType;
  row.startTime = input.timeType === "fixed" ? input.startTime : null;
  row.title = input.title;
  row.updatedAt = new Date();
  return { id: row.id, date: row.date, timeType: row.timeType, startTime: row.startTime, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt };
});
vi.spyOn(spModule, "deleteStreamPlan").mockImplementation(async (id: string) => {
  const before = plansStore.length;
  plansStore = plansStore.filter((r) => r.id !== id);
  return plansStore.length !== before;
});
vi.spyOn(spModule, "listStreamPlans").mockImplementation(async (from?: string, to?: string) => {
  const filtered = plansStore
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  // 应用层排序：date 升序 → 类型秩 → startTime 升序
  const timeTypeRank = (t: TimeType) => t === "allDay" ? 0 : t === "fixed" ? 1 : 2;
  filtered.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const rankCmp = timeTypeRank(a.timeType) - timeTypeRank(b.timeType);
    if (rankCmp !== 0) return rankCmp;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
  return filtered.map((r) => ({ id: r.id, date: r.date, timeType: r.timeType, startTime: r.startTime, title: r.title, createdAt: r.createdAt, updatedAt: r.updatedAt }));
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

describe("isValidTime", () => {
  it("合法 HH:mm", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("09:05")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("08:00")).toBe(true);
  });

  it("非法时间", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("9:5")).toBe(false); // 必须补零
    expect(isValidTime("12:")).toBe(false);
    expect(isValidTime("8:00")).toBe(false);
    expect(isValidTime("abc")).toBe(false);
  });
});

describe("GET /api/stream-plans（公开读）", () => {
  it("未登录可读，空库返回空数组", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/stream-plans" });
    expect(r.status).toBe(200);
    expect((r.body as { plans: unknown[] }).plans).toEqual([]);
  });

  it("按 from/to 区间过滤且按 date + startTime 升序", async () => {
    plansStore.push(
      { id: "356a192b7913b04c54574d18", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "晚场", createdBy: "a", createdAt: new Date() },
      { id: "da4b9237bacccdf19c0760ca", date: "2026-08-15", timeType: "fixed", startTime: "13:00", title: "午场", createdBy: "a", createdAt: new Date() },
      { id: "77de68daecd823babbb58edb", date: "2026-08-20", timeType: "fixed", startTime: "08:00", title: "早场", createdBy: "a", createdAt: new Date() },
    );
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "GET", path: "/api/stream-plans?from=2026-08-12&to=2026-08-18" });
    expect(r.status).toBe(200);
    const plans = (r.body as { plans: Array<{ date: string; startTime: string }> }).plans;
    expect(plans.map((p) => `${p.date} ${p.startTime}`)).toEqual(["2026-08-15 13:00", "2026-08-15 20:00"]);
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
    const r = await call(app, { method: "POST", path: "/api/stream-plans", body: { date: "2026-08-15", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(401);
  });

  it("member 登录 → 403", async () => {
    usersStore["member1"] = { username: "member1", passwordHash: await hashPassword("Member1abc123!@#$"), role: "member", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "member1", "Member1abc123!@#$");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(403);
  });

  it("admin 登录创建 → 201", async () => {
    usersStore["admin1"] = { username: "admin1", passwordHash: await hashPassword("Admin1abc123!@#$%"), role: "admin", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "admin1", "Admin1abc123!@#$%");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(201);
    const b = r.body as { ok: boolean; id: string; date: string; startTime: string; title: string };
    expect(b.ok).toBe(true);
    expect(b.date).toBe("2026-08-15");
    expect(b.startTime).toBe("20:00");
    expect(b.title).toBe("杂谈");
  });

  it("日期格式非法 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-02-30", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(400);
  });

  it("开始时间缺失 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", title: "杂谈" } });
    expect(r.status).toBe(400);
  });

  it("开始时间非法 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "24:00", title: "杂谈" } });
    expect(r.status).toBe(400);
  });

  it("主题为空 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "   " } });
    expect(r.status).toBe(400);
  });

  it("主题超 50 字符 → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "x".repeat(51) } });
    expect(r.status).toBe(400);
  });

  it("同日同时间同主题 → 409", async () => {
    plansStore.push({ id: "356a192b7913b04c54574d18", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(409);
  });

  it("同日期不同时间不同主题不判重 → 201", async () => {
    plansStore.push({ id: "356a192b7913b04c54574d18", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "POST", path: "/api/stream-plans", cookie: sid, body: { date: "2026-08-15", startTime: "13:00", title: "午场" } });
    expect(r.status).toBe(201);
  });
});

describe("PUT /api/stream-plans/:id（受限写）", () => {
  it("未登录 → 401", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(401);
  });

  it("member 登录 → 403", async () => {
    usersStore["member1"] = { username: "member1", passwordHash: await hashPassword("Member1abc123!@#$"), role: "member", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "member1", "Member1abc123!@#$");
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid, body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(403);
  });

  it("id 非合法 ObjectId → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/not-a-valid-oid", cookie: sid, body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(400);
  });

  it("改期（日期+时间+主题）→ 200 且返回更新值", async () => {
    plansStore.push({ id: "a0cdba16ea800a2e157e18fd", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid, body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(200);
    const b = r.body as { ok: boolean; date: string; startTime: string; title: string };
    expect(b.ok).toBe(true);
    expect(b.date).toBe("2026-08-16");
    expect(b.startTime).toBe("21:00");
    expect(b.title).toBe("歌杂");
  });

  it("计划不存在 → 404", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/5315a113e73d0bf8a58fc211", cookie: sid, body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(404);
  });

  it("与他人计划重复（排除自身）→ 409", async () => {
    plansStore.push(
      { id: "a0cdba16ea800a2e157e18fd", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() },
      { id: "6392a306f40cac2d5a649f28", date: "2026-08-16", timeType: "fixed", startTime: "21:00", title: "歌杂", createdBy: "a", createdAt: new Date() },
    );
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    // 把 sp-1 改成 sp-2 已有组合 → 409
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid, body: { date: "2026-08-16", startTime: "21:00", title: "歌杂" } });
    expect(r.status).toBe(409);
  });

  it("保留自身原值不算重复 → 200", async () => {
    plansStore.push({ id: "a0cdba16ea800a2e157e18fd", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "PUT", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid, body: { date: "2026-08-15", startTime: "20:00", title: "杂谈" } });
    expect(r.status).toBe(200);
  });
});

describe("DELETE /api/stream-plans/:id（受限写）", () => {
  it("未登录 → 401", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const r = await call(app, { method: "DELETE", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd" });
    expect(r.status).toBe(401);
  });

  it("member 登录 → 403", async () => {
    usersStore["member1"] = { username: "member1", passwordHash: await hashPassword("Member1abc123!@#$"), role: "member", mustChangePassword: false };
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "member1", "Member1abc123!@#$");
    const r = await call(app, { method: "DELETE", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid });
    expect(r.status).toBe(403);
  });

  it("id 非合法 ObjectId → 400", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "DELETE", path: "/api/stream-plans/not-a-valid-oid", cookie: sid });
    expect(r.status).toBe(400);
  });

  it("删除存在的计划 → 200", async () => {
    plansStore.push({ id: "a0cdba16ea800a2e157e18fd", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdBy: "a", createdAt: new Date() });
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "DELETE", path: "/api/stream-plans/a0cdba16ea800a2e157e18fd", cookie: sid });
    expect(r.status).toBe(200);
    expect((r.body as { ok: boolean }).ok).toBe(true);
    expect(plansStore).toHaveLength(0);
  });

  it("删除不存在的计划 → 404", async () => {
    const app = createApp({ sessionStore: memSessionStore(), rateLimiter: unlimited });
    const sid = await login(app, "supersumire", "salamander");
    const r = await call(app, { method: "DELETE", path: "/api/stream-plans/5315a113e73d0bf8a58fc211", cookie: sid });
    expect(r.status).toBe(404);
  });
});
