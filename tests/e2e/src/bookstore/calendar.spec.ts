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

  test("home-entry-to-calendar: 主页出现本周日程入口(含开播时间)，可进入 /calendar", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "本周日程" })).toBeVisible();
    const link = page.getByRole("link", { name: /查看完整日历/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
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
