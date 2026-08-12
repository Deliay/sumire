import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("backdoor auth guard", () => {
  test("auth-redirect (AC-1): 未登录访问 /backdoor 跳转 /backdoor/login", async ({ page }) => {
    await page.goto(`${BASE}/backdoor`);
    await expect(page).toHaveURL(/\/backdoor\/login$/);
    await expect(page.getByLabel("用户名")).toBeVisible();
  });

  test("login-success (AC-2, AC-5): 已完成改密账号登录进入仪表盘，reload 后仍在", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page).toHaveURL(/\/backdoor$/);
    await expect(page.getByRole("heading", { name: /欢迎回来/ })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/backdoor$/);
  });

  test("login-failure (AC-3): 错误密码停留登录页并提示「账号或密码错误」", async ({ page }) => {
    const accounts = getAccounts();
    await page.goto(`${BASE}/backdoor/login`);
    await page.getByLabel("用户名").fill(accounts.member.username);
    await page.getByLabel("密码").fill("wrong-password-123456");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByText("账号或密码错误")).toBeVisible();
    await expect(page.getByLabel("密码")).toHaveValue("");
    await expect(page).toHaveURL(/\/backdoor\/login$/);
  });

  test("logout-entry / logout-invalidates (AC-6, AC-7): 点击登出回登录页，再访问 /backdoor 重新要求登录", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/backdoor\/login$/);
    await page.goto(`${BASE}/backdoor`);
    await expect(page).toHaveURL(/\/backdoor\/login$/);
  });
});
