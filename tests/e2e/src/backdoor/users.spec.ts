import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { apiRequest } from "../tools/api";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

async function superadminSid() {
  const accounts = getAccounts();
  const res = await apiRequest("/api/auth/login", "POST", {
    username: accounts.superadmin.username,
    password: accounts.superadmin.password,
  });
  return res.cookie?.match(/sumire_sid=([^;]+)/)?.[1];
}

test.describe("backdoor users", () => {
  test("users-list-superadmin (AC-19, AC-21): 超管用户管理可见账号列表，并可经 dialog 创建管理员", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "用户管理" })).toBeVisible();
    await page.getByRole("link", { name: "用户管理" }).click();
    await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
    await expect(page.getByText("supersumire")).toBeVisible();
    await expect(page.getByText(accounts.admin.username)).toBeVisible();

    // 通过 dialog 创建管理员账号
    const run = Date.now().toString(36);
    const newAdmin = `e2e_ua_${run}`;
    await page.getByRole("button", { name: /增加用户/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("用户名").fill(newAdmin);
    await page.getByLabel("初始密码").fill(`E2e_UA_${run}Z9!`);
    // 超管可选任意角色，在 dialog 内选择「管理员」
    await page.getByRole("dialog").getByText("管理员", { exact: true }).click();
    await page.getByRole("button", { name: "创建用户" }).click();
    await expect(page.getByRole("status")).toContainText("已创建");
    await expect(page.getByRole("cell", { name: newAdmin })).toBeVisible();
  });

  test("users-list-hidden (AC-20): 管理员/成员导航无用户管理；直接访问被引导回仪表盘", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.admin, BASE);
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);
    await page.goto(`${BASE}/backdoor/users`);
    await expect(page).toHaveURL(/\/backdoor$/);
  });

  test("create-user-in-dialog (AC-24): 超管经 dialog 创建成员，非法输入（用户名空）被拒并提示", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "用户管理" }).click();
    await page.getByRole("button", { name: /增加用户/ }).click();
    await page.getByRole("button", { name: "创建用户" }).click();
    // 用户名空/密码空 → 表单原生校验拦截，dialog 保持打开
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("nav-by-role (AC-23, AC-27): 三种角色导航按角色渲染", async ({ page }) => {
    const accounts = getAccounts();

    // 成员：仅仪表盘
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);

    // 管理员：仅仪表盘（无用户管理）
    await page.getByRole("button", { name: "登出" }).click();
    await loginViaUi(page, accounts.admin, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);

    // 超管：仪表盘 + 用户管理
    await page.getByRole("button", { name: "登出" }).click();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "用户管理" })).toBeVisible();
  });
});
