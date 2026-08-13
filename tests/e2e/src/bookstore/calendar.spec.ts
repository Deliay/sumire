import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { apiRequest } from "../tools/api";
import { loginViaUi } from "../backdoor/helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";
const API = process.env.API_BASE_URL ?? "";

test.describe("bookstore 日历页与主页入口", () => {
  test("calendar-public: 后台录入的计划在公开日历页可见，访客无需登录", async ({ page }) => {
    // 以超管经 API 录入一条明确日期的计划
    const run = Date.now().toString(36);
    const title = `e2e_pub_${run}`;
    const dateInput = "2099-01-15";
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
      { date: dateInput, title },
      sid,
    );
    expect(create.status).toBe(201);

    // 访客无需登录打开公开日历页
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
    await expect(page.getByText("直播日程")).toBeVisible();
  });

  test("home-entry-to-calendar: 主页出现本周日程入口，可进入 /calendar", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "本周日程" })).toBeVisible();
    const link = page.getByRole("link", { name: /查看完整日历/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
  });
});
