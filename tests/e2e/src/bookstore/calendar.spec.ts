import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { apiRequest } from "../tools/api";
import { loginViaUi } from "../backdoor/helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";
const API = process.env.API_BASE_URL ?? "";

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** 以超管经 API 创建一条计划并返回 { id, date }。 */
async function createPlan(dateInput: string, title: string): Promise<string> {
  const accounts = getAccounts();
  const login = await apiRequest("/api/auth/login", "POST", {
    username: accounts.superadmin.username,
    password: accounts.superadmin.password,
  });
  const sid = login.cookie?.match(/sumire_sid=([^;]+)/)?.[1];
  if (!sid) throw new Error("登录失败，无法取得会话");
  const create = await apiRequest(
    "/api/stream-plans",
    "POST",
    { date: dateInput, startTime: "20:00", title },
    sid,
  );
  expect(create.status).toBe(201);
  return (create.body as { id: string }).id;
}

/** 以超管经 API 删除一条计划（用于清理测试数据，保证用例幂等可重复运行）。 */
async function deletePlan(planId: string): Promise<void> {
  const accounts = getAccounts();
  const login = await apiRequest("/api/auth/login", "POST", {
    username: accounts.superadmin.username,
    password: accounts.superadmin.password,
  });
  const sid = login.cookie?.match(/sumire_sid=([^;]+)/)?.[1];
  if (!sid) throw new Error("登录失败，无法取得会话");
  const del = await apiRequest(`/api/stream-plans/${planId}`, "DELETE", undefined, sid);
  // 允许 204/200；若已不存在（其他并发清理）也视为成功
  expect([200, 204, 404]).toContain(del.status);
}

test.describe("bookstore 日历页与主页入口", () => {
  test("calendar-public-range: 访客无需登录查看，初始按当前月区间拉取(携带 from/to)", async ({ page }) => {
    // 录入一条远期计划，验证不是一次性全量加载
    const run = Date.now().toString(36);
    await createPlan("2099-01-15", `e2e_pub_${run}`);

    const streamPlanRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/stream-plans")) streamPlanRequests.push(req.url());
    });

    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();

    await expect
      .poll(() => streamPlanRequests.find((u) => u.includes("from=") && u.includes("to=")))
      .toBeTruthy();
  });

  test("calendar-day-readonly: 点击有计划的一天弹出只读当日安排，无管理操作", async ({ page }) => {
    const run = Date.now().toString(36);
    const title = `e2e_ro_${run}`;
    const d = todayStr();
    await createPlan(d, title);

    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();

    const dayCell = page.locator(`[data-testid="calendar-day"][data-date="${d}"]`);
    await dayCell.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(title)).toBeVisible();
    await expect(dialog.getByText(/20:00/).first()).toBeVisible();
    // 只读：无任何管理操作
    await expect(page.getByRole("button", { name: /增加计划/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  });

  test("calendar-grid-fill-cell: 跨月补位格日程按展示网格范围取数后可见、弱化且不可点击", async ({ page }) => {
    const run = Date.now().toString(36);
    const title = `e2e_grid_${run}`;
    const fillDate = gridFillCellDate();
    const planId = await createPlan(fillDate, title);

    try {
      await page.goto(`${BASE}/calendar`);
      await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();

      const cell = page.locator(`[data-testid="calendar-day"][data-date="${fillDate}"]`);
      await expect(cell).toBeVisible();
      // 补位格弱化样式保留
      await expect(cell).toHaveClass(/opacity-35/);
      // 日程摘要可见（同格计划 ≤2 条时不被折叠；本用例自建即清理保证幂等）
      await expect(cell.getByText(title)).toBeVisible();
      // 补位格不可点击：点击不弹当日详情
      await cell.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally {
      // 清理本用例创建的计划，避免同补位格日期累积 >2 条导致摘要折叠、用例转红
      await deletePlan(planId);
    }
  });

  test("home-entry-to-calendar: 主页不再内嵌本周日程；导航「日历」锚点进入", async ({ page }) => {
    await page.goto(BASE);
    // 首页不出现本周日程大卡
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    // 经导航栏日历链接（锚点 #calendar，桌面 nav）翻页至日历站
    await page.locator("header ul").first().getByRole("link", { name: "日历" }).click();
    await expect(page.getByText(/年 .*月/).first()).toBeVisible();
  });

  test("calendar-immersive-bars: 全幅 immersive 月视图左右全高翻月竖条可翻月", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
    const before = await page.locator("h2").filter({ hasText: /年 .*月/ }).first().textContent();
    await page.getByRole("button", { name: "下月" }).click();
    await expect
      .poll(async () => page.locator("h2").filter({ hasText: /年 .*月/ }).first().textContent())
      .not.toBe(before);
  });

  test("calendar-mixed-history: 日历同日混合展示计划与历史记录（来源可辨），历史只读", async ({ page }) => {
    const run = Date.now().toString(36);
    const planTitle = `e2e_plan_${run}`;
    const histTitle = `e2e_hist_${run}`;
    const d = todayStr();
    await createPlan(d, planTitle);

    // 历史记录：今日 00:00（本地，已过），保证按本地时区归入今日且不被视为未来
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(1, 0, 0, 0);
    await page.route("**/api/live-history", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          records: [{ title: histTitle, startDate: start.toISOString(), stopDate: end.toISOString() }],
        }),
      }),
    );

    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();

    // 点击当日弹层：计划与历史混合列出，历史行带「实际播出」标签、只读
    const cell = page.locator(`[data-testid="calendar-day"][data-date="${d}"]`);
    await cell.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(planTitle)).toBeVisible();
    await expect(dialog.getByText(histTitle)).toBeVisible();
    await expect(dialog.getByText("实际播出")).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  });

  test("calendar-history-degrade: 历史源降级时仅展示计划且无错误提示", async ({ page }) => {
    const run = Date.now().toString(36);
    const title = `e2e_deg_${run}`;
    const d = todayStr();
    await createPlan(d, title);

    await page.route("**/api/live-history", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, records: [] }),
      }),
    );

    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();

    const cell = page.locator(`[data-testid="calendar-day"][data-date="${d}"]`);
    await cell.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(title)).toBeVisible();
    await expect(dialog.getByText("实际播出")).toHaveCount(0);
    await expect(page.getByText("日程暂时翻不开了")).toHaveCount(0);
  });
});

function shiftDateStr(s: string, days: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function dateStrOf(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** 取当前月视图网格中一个跨月补位格日期（优先上月末，月初周一则取下月 1 号）。 */
function gridFillCellDate(): string {
  const now = new Date();
  const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  if (offset > 0) {
    return dateStrOf(new Date(now.getFullYear(), now.getMonth(), 0)); // 上月最后一天
  }
  return dateStrOf(new Date(now.getFullYear(), now.getMonth() + 1, 1)); // 下月 1 号
}

test.describe("bookstore 日历页移动端周视图", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("calendar-mobile-week-view: 小宽度渲染周视图（恰好 7 天且含今天）", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
    const cells = page.locator('[data-testid="calendar-day"]');
    await expect(cells).toHaveCount(7);
    const today = todayStr();
    await expect(page.locator(`[data-testid="calendar-day"][data-date="${today}"]`)).toBeVisible();
  });

  test("calendar-mobile-week-switch: 周切换标题区间变化且格子平移 7 天", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.locator('[data-testid="calendar-day"]')).toHaveCount(7);
    const heading = page.getByRole("heading", { name: /年 .*月 · / });
    await expect(heading).toBeVisible();
    const beforeTitle = await heading.textContent();
    const before = await page
      .locator('[data-testid="calendar-day"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-date")));

    await page.getByRole("button", { name: "下一周" }).click();
    await expect.poll(async () => await heading.textContent()).not.toBe(beforeTitle);

    const after = await page
      .locator('[data-testid="calendar-day"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-date")));
    for (let i = 0; i < 7; i++) {
      expect(after[i]).toBe(shiftDateStr(before[i]!, 7));
    }
  });

  test("calendar-mobile-week-today: 今天回到本周", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.locator('[data-testid="calendar-day"]')).toHaveCount(7);
    await page.getByRole("button", { name: "下一周" }).click();
    await page.getByRole("button", { name: "今天" }).click();
    const today = todayStr();
    await expect(page.locator(`[data-testid="calendar-day"][data-date="${today}"]`)).toBeVisible();
  });

  test("calendar-mobile-week-day-dialog: 周视图点天打开只读弹层", async ({ page }) => {
    const run = Date.now().toString(36);
    const title = `e2e_wk_${run}`;
    const d = todayStr();
    await createPlan(d, title);

    await page.goto(`${BASE}/calendar`);
    await expect(page.locator('[data-testid="calendar-day"]')).toHaveCount(7);
    await page.locator(`[data-testid="calendar-day"][data-date="${d}"]`).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(title)).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
  });
});
