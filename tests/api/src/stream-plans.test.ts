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

/** 取一段当日附近的日期串，避免用例间因日期边界互相影响。 */
function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 随机合法 HH:mm。 */
function timeStr(): string {
  const h = String(Math.floor(Math.random() * 24)).padStart(2, "0");
  const m = ["00", "15", "30", "45"][Math.floor(Math.random() * 4)];
  return `${h}:${m}`;
}

const INVALID_OBJECT_ID = "not-a-valid-object-id";

describe("GET /api/stream-plans（公开读）", () => {
  it("stream-plans-get-200: 未登录可读，返回数组（空库为空数组）", async () => {
    const res = await request("/api/stream-plans");
    expect(res.status).toBe(200);
    const plans = (res.body as { plans: unknown[] }).plans;
    expect(Array.isArray(plans)).toBe(true);
  });

  it("stream-plans-get-range: 区间过滤含边界端点，按 date + startTime 升序", async () => {
    const sa = await asSuperadmin();
    const d0 = dateStr(-5);
    const d1 = dateStr(0);
    const d2 = dateStr(5);
    const title = `range_${rand()}`;
    for (const d of [d0, d1, d2]) {
      const r = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: timeStr(), title: `${title}_${d}` } });
      expect(r.status).toBe(201);
    }
    const res = await request(`/api/stream-plans?from=${d1}&to=${d2}`);
    expect(res.status).toBe(200);
    const dates = (res.body as { plans: Array<{ date: string; title: string }> }).plans
      .filter((p) => p.title.startsWith(title))
      .map((p) => p.date);
    expect(dates).toEqual([d1, d2]); // 含端点，升序
  });

  it("stream-plans-get-sort: 同日多场按开始时间升序", async () => {
    const sa = await asSuperadmin();
    const d = dateStr(8);
    const title = `sort_${rand()}`;
    for (const st of ["20:00", "08:00", "13:00"]) {
      const r = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: st, title: `${title}_${st}` } });
      expect(r.status).toBe(201);
    }
    const res = await request(`/api/stream-plans?from=${d}&to=${d}`);
    const times = (res.body as { plans: Array<{ title: string; startTime: string }> }).plans
      .filter((p) => p.title.startsWith(title))
      .map((p) => p.startTime);
    expect(times).toEqual(["08:00", "13:00", "20:00"]);
  });

  it("stream-plans-get-400: 非法日期参数 → 400", async () => {
    const r1 = await request("/api/stream-plans?from=2026/08/15");
    const r2 = await request("/api/stream-plans?to=2026-13-01");
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });
});

describe("POST /api/stream-plans（受限写）", () => {
  it("stream-plans-post-401: 未登录 → 401", async () => {
    const res = await request("/api/stream-plans", {
      method: "POST",
      body: { date: dateStr(3), startTime: "20:00", title: "杂谈" },
    });
    expect(res.status).toBe(401);
  });

  it("stream-plans-post-403: member → 403", async () => {
    const member = await createRoleAccount("member", `mb_${rand()}`, strongPassword);
    const res = await request("/api/stream-plans", {
      method: "POST",
      jar: member,
      body: { date: dateStr(3), startTime: "20:00", title: "杂谈" },
    });
    expect(res.status).toBe(403);
  });

  it("stream-plans-post-201: admin 与 superadmin 均可创建并持久化", async () => {
    const admin = await createRoleAccount("admin", `ad_${rand()}`, strongPassword);
    const d = dateStr(2);
    const st = timeStr();
    const title = `计划_${rand()}`;
    const rAdmin = await request("/api/stream-plans", { method: "POST", jar: admin, body: { date: d, startTime: st, title } });
    expect(rAdmin.status).toBe(201);
    const body = rAdmin.body as { ok: boolean; id: string; date: string; startTime: string; title: string };
    expect(body.ok).toBe(true);
    expect(body.date).toBe(d);
    expect(body.startTime).toBe(st);
    expect(body.title).toBe(title);

    // 持久化：写入后 GET 可读
    const list = await request(`/api/stream-plans?from=${d}&to=${d}`);
    const found = (list.body as { plans: Array<{ id: string; title: string }> }).plans.some(
      (p) => p.id === body.id && p.title === title,
    );
    expect(found).toBe(true);
  });

  it("stream-plans-post-400: 日期非法 / 主题空 / 主题超 50 / 开始时间缺失 / 开始时间非法 → 400", async () => {
    const sa = await asSuperadmin();
    const r1 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: "2026-02-30", startTime: "20:00", title: "杂谈" } });
    const r2 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), startTime: "20:00", title: "   " } });
    const r3 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), startTime: "20:00", title: "x".repeat(51) } });
    const r4 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), title: "杂谈" } });
    const r5 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), startTime: "24:00", title: "杂谈" } });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(400);
    expect(r4.status).toBe(400);
    expect(r5.status).toBe(400);
  });

  it("stream-plans-post-409: 同日同时间同主题 → 409，同日不同时间 → 201", async () => {
    const sa = await asSuperadmin();
    const d = dateStr(4);
    const st = timeStr();
    const title = `dupe_${rand()}`;
    const first = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: st, title } });
    expect(first.status).toBe(201);
    const dup = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: st, title } });
    expect(dup.status).toBe(409);
    expect((dup.body as { error?: string }).error).toBe("该日该时间已有相同主题的直播计划");
    const otherTime = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: "22:00", title } });
    expect(otherTime.status).toBe(201);
  });
});

describe("PUT /api/stream-plans/:id（受限写）", () => {
  it("stream-plans-put-401: 未登录 → 401", async () => {
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "PUT", body: { date: dateStr(1), startTime: "20:00", title: "x" } });
    expect(res.status).toBe(401);
  });

  it("stream-plans-put-403: member → 403", async () => {
    const member = await createRoleAccount("member", `mbp_${rand()}`, strongPassword);
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "PUT", jar: member, body: { date: dateStr(1), startTime: "20:00", title: "x" } });
    expect(res.status).toBe(403);
  });

  it("stream-plans-put-400: id 非 ObjectId → 400", async () => {
    const sa = await asSuperadmin();
    const res = await request(`/api/stream-plans/${INVALID_OBJECT_ID}`, { method: "PUT", jar: sa, body: { date: dateStr(1), startTime: "20:00", title: "x" } });
    expect(res.status).toBe(400);
  });

  it("stream-plans-put-200: 改期 + 改时间 + 改主题，写后区间归属更新", async () => {
    const sa = await asSuperadmin();
    const dOld = dateStr(3);
    const dNew = dateStr(9);
    const title = `put_${rand()}`;
    const create = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dOld, startTime: "08:00", title } });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;
    const r = await request(`/api/stream-plans/${id}`, { method: "PUT", jar: sa, body: { date: dNew, startTime: "21:00", title: `${title}_改` } });
    expect(r.status).toBe(200);
    const body = r.body as { ok: boolean; date: string; startTime: string; title: string };
    expect(body.ok).toBe(true);
    expect(body.date).toBe(dNew);
    expect(body.startTime).toBe("21:00");
    expect(body.title).toBe(`${title}_改`);
    // 原区间不再包含，新区间包含
    const oldRange = await request(`/api/stream-plans?from=${dOld}&to=${dOld}`);
    expect((oldRange.body as { plans: Array<{ id: string }> }).plans.some((p) => p.id === id)).toBe(false);
    const newRange = await request(`/api/stream-plans?from=${dNew}&to=${dNew}`);
    expect((newRange.body as { plans: Array<{ id: string }> }).plans.some((p) => p.id === id)).toBe(true);
  });

  it("stream-plans-put-404: 计划不存在 → 404", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "PUT", jar: sa, body: { date: dateStr(1), startTime: "20:00", title: "x" } });
    expect(res.status).toBe(404);
  });

  it("stream-plans-put-409: 撞他人计划 → 409，保留自身原值 → 200", async () => {
    const sa = await asSuperadmin();
    const d = dateStr(6);
    const st = timeStr();
    const tA = `confA_${rand()}`;
    const tB = `confB_${rand()}`;
    const a = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: st, title: tA } });
    const b = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: st, title: tB } });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const bId = (b.body as { id: string }).id;
    // 把 B 改成 A 的组合 → 409（撞他人）
    const conflict = await request(`/api/stream-plans/${bId}`, { method: "PUT", jar: sa, body: { date: d, startTime: st, title: tA } });
    expect(conflict.status).toBe(409);
    // B 保留自身原值 → 200
    const same = await request(`/api/stream-plans/${bId}`, { method: "PUT", jar: sa, body: { date: d, startTime: st, title: tB } });
    expect(same.status).toBe(200);
  });
});

describe("DELETE /api/stream-plans/:id（受限写）", () => {
  it("stream-plans-delete-401: 未登录 → 401", async () => {
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("stream-plans-delete-403: member → 403", async () => {
    const member = await createRoleAccount("member", `mbd_${rand()}`, strongPassword);
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "DELETE", jar: member });
    expect(res.status).toBe(403);
  });

  it("stream-plans-delete-400: id 非 ObjectId → 400", async () => {
    const sa = await asSuperadmin();
    const res = await request(`/api/stream-plans/${INVALID_OBJECT_ID}`, { method: "DELETE", jar: sa });
    expect(res.status).toBe(400);
  });

  it("stream-plans-delete-200: 删除成功，写后 GET 不再包含", async () => {
    const sa = await asSuperadmin();
    const d = dateStr(7);
    const title = `del_${rand()}`;
    const create = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, startTime: timeStr(), title } });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;
    const r = await request(`/api/stream-plans/${id}`, { method: "DELETE", jar: sa });
    expect(r.status).toBe(200);
    expect((r.body as { ok: boolean }).ok).toBe(true);
    const list = await request(`/api/stream-plans?from=${d}&to=${d}`);
    expect((list.body as { plans: Array<{ id: string }> }).plans.some((p) => p.id === id)).toBe(false);
  });

  it("stream-plans-delete-404: 计划不存在 → 404", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/stream-plans/aaaaaaaaaaaaaaaaaaaaaaaa", { method: "DELETE", jar: sa });
    expect(res.status).toBe(404);
  });
});
