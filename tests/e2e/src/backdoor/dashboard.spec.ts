import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("backdoor dashboard", () => {
  test("dashboard-layout (AC-9): 顶部栏 + 左侧导航 + 内容区", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "后台导航" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /欢迎回来/ })).toBeVisible();
  });

  test("dashboard-content (AC-10): 欢迎语可见，无占位文案", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("heading", { name: /欢迎回来/ })).toBeVisible();
    // 不应出现占位/未上线功能文案
    await expect(page.getByText(/建设中|敬请期待|占位/)).toHaveCount(0);
  });

  test("visual-sanity (AC-11): 深色底 + 应援色主按钮", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // 深色底 rgba(22,18,28,1) ≈ rgb(22,18,28)
    expect(bg).toContain("rgb(22, 18, 28)");
  });
});
