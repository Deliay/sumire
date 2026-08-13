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

describe("GET /api/stream-plans（公开读）", () => {
  it("stream-plans-get-200: 未登录可读，返回数组（空库为空数组）", async () => {
    const res = await request("/api/stream-plans");
    expect(res.status).toBe(200);
    const plans = (res.body as { plans: unknown[] }).plans;
    expect(Array.isArray(plans)).toBe(true);
  });

  it("stream-plans-get-range: 区间过滤含边界端点", async () => {
    const sa = await asSuperadmin();
    const d0 = dateStr(-5);
    const d1 = dateStr(0);
    const d2 = dateStr(5);
    const title = `range_${rand()}`;
    const created: string[] = [];
    for (const d of [d0, d1, d2]) {
      const r = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, title: `${title}_${d}` } });
      expect(r.status).toBe(201);
      created.push(d);
    }
    const res = await request(`/api/stream-plans?from=${d1}&to=${d2}`);
    expect(res.status).toBe(200);
    const dates = (res.body as { plans: Array<{ date: string; title: string }> }).plans
      .filter((p) => p.title.startsWith(title))
      .map((p) => p.date);
    expect(dates).toEqual([d1, d2]); // 含端点，升序
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
      body: { date: dateStr(3), title: "杂谈" },
    });
    expect(res.status).toBe(401);
  });

  it("stream-plans-post-403: member → 403", async () => {
    const member = await createRoleAccount("member", `mb_${rand()}`, strongPassword);
    const res = await request("/api/stream-plans", {
      method: "POST",
      jar: member,
      body: { date: dateStr(3), title: "杂谈" },
    });
    expect(res.status).toBe(403);
  });

  it("stream-plans-post-201: admin 与 superadmin 均可创建并持久化", async () => {
    const admin = await createRoleAccount("admin", `ad_${rand()}`, strongPassword);
    const d = dateStr(2);
    const title = `计划_${rand()}`;
    const rAdmin = await request("/api/stream-plans", { method: "POST", jar: admin, body: { date: d, title } });
    expect(rAdmin.status).toBe(201);
    const body = rAdmin.body as { ok: boolean; id: string; date: string; title: string };
    expect(body.ok).toBe(true);
    expect(body.date).toBe(d);
    expect(body.title).toBe(title);

    // 持久化：写入后 GET 可读
    const list = await request(`/api/stream-plans?from=${d}&to=${d}`);
    const found = (list.body as { plans: Array<{ id: string; title: string }> }).plans.some(
      (p) => p.id === body.id && p.title === title,
    );
    expect(found).toBe(true);
  });

  it("stream-plans-post-400: 日期非法 / 主题空 / 主题超 50 字符 → 400", async () => {
    const sa = await asSuperadmin();
    const r1 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: "2026-02-30", title: "杂谈" } });
    const r2 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), title: "   " } });
    const r3 = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: dateStr(1), title: "x".repeat(51) } });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(400);
  });

  it("stream-plans-post-409: 同日同主题 → 409，同日不同主题 → 201", async () => {
    const sa = await asSuperadmin();
    const d = dateStr(4);
    const title = `dupe_${rand()}`;
    const first = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, title } });
    expect(first.status).toBe(201);
    const dup = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, title } });
    expect(dup.status).toBe(409);
    expect((dup.body as { error?: string }).error).toBe("该日已有相同主题的直播计划");
    const other = await request("/api/stream-plans", { method: "POST", jar: sa, body: { date: d, title: `${title}_B` } });
    expect(other.status).toBe(201);
  });
});
