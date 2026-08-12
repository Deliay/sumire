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
  test("users-list-superadmin (AC-19, AC-21): 超管导航含用户管理，列表可见种子与新账号，可创建管理员", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "用户管理" })).toBeVisible();
    await page.getByRole("link", { name: "用户管理" }).click();
    await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
    await expect(page.getByText("supersumire")).toBeVisible();
    await expect(page.getByText(accounts.admin.username)).toBeVisible();

    // 创建管理员账号
    const run = Date.now().toString(36);
    const newAdmin = `e2e_ua_${run}`;
    const newAdminPw = `E2e_UA_${run}Z9!`;
    const sid = await superadminSid();
    const create = await apiRequest("/api/users", "POST", {
      username: newAdmin,
      password: newAdminPw,
      role: "admin",
    }, sid);
    expect(create.status).toBe(201);
    await page.reload();
    await expect(page.getByText(newAdmin)).toBeVisible();
  });

  test("users-list-hidden (AC-20): 管理员/成员导航无用户管理；直接访问被引导回仪表盘", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.admin, BASE);
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);
    await page.goto(`${BASE}/backdoor/users`);
    await expect(page).toHaveURL(/\/backdoor$/);
  });

  test("create-user-by-admin (AC-22): 管理员可创建成员，角色选项仅成员", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.admin, BASE);
    await page.getByRole("link", { name: "增加用户" }).click();
    // 角色单选仅成员（无「管理员/超级管理员」选项）
    await expect(page.getByText(/成员/)).toBeVisible();
    const run = Date.now().toString(36);
    const newMember = `e2e_am_${run}`;
    await page.getByLabel("用户名").fill(newMember);
    await page.getByLabel("初始密码").fill(`E2e_AM_${run}Z9!`);
    await page.getByRole("button", { name: "创建用户" }).click();
    await expect(page.getByRole("status")).toContainText("已创建");
  });

  test("nav-by-role (AC-23, AC-27): 三种角色导航按角色渲染", async ({ page }) => {
    const accounts = getAccounts();

    // 成员：仅仪表盘
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "增加用户" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);

    // 管理员：仪表盘 + 增加用户
    await page.getByRole("button", { name: "登出" }).click();
    await loginViaUi(page, accounts.admin, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "增加用户" })).toBeVisible();
    await expect(page.getByRole("link", { name: "用户管理" })).toHaveCount(0);

    // 超管：仪表盘 + 增加用户 + 用户管理
    await page.getByRole("button", { name: "登出" }).click();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "仪表盘" })).toBeVisible();
    await expect(page.getByRole("link", { name: "增加用户" })).toBeVisible();
    await expect(page.getByRole("link", { name: "用户管理" })).toBeVisible();
  });
});
