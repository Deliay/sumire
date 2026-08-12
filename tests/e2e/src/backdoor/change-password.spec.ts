import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { apiRequest, requireApiUrl } from "../tools/api";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

/** 通过 API 创建全新成员账号（未改密），返回其凭据，避免污染其它用例依赖的共享账号。 */
async function createFreshMember() {
  const run = Date.now().toString(36);
  const username = `e2e_cp_${run}`;
  const initialPassword = `E2e_InitCp_${run}Z9!`;
  const accounts = getAccounts();
  const login = await apiRequest("/api/auth/login", "POST", {
    username: accounts.superadmin.username,
    password: accounts.superadmin.password,
  });
  const sid = login.cookie?.match(/sumire_sid=([^;]+)/)?.[1];
  if (!sid) throw new Error("superadmin login failed in helper");
  const create = await apiRequest("/api/users", "POST", {
    username,
    password: initialPassword,
    role: "member",
  }, sid);
  if (create.status !== 201) throw new Error(`create fresh member failed: ${JSON.stringify(create.body)}`);
  return { username, initialPassword };
}

async function loginWithCredentials(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto(`${BASE}/backdoor/login`);
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  // 等待登录后 SPA 导航完成，确保会话建立（已完成改密 → 仪表盘；初始密码 → 改密页）
  await expect(page).toHaveURL(/\/backdoor\/change-password|\/backdoor$/);
}

test.describe("backdoor change-password", () => {
  test("force-change-password (AC-15): 初始密码账号登录落到改密页", async ({ page }) => {
    requireApiUrl();
    const { username, initialPassword } = await createFreshMember();
    await loginWithCredentials(page, username, initialPassword);
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
    // 直接访问仪表盘被引导回改密页
    await page.goto(`${BASE}/backdoor`);
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
  });

  test("change-password-invalid (AC-16, AC-25): 弱密码被拒并停留改密页", async ({ page }) => {
    requireApiUrl();
    const { username, initialPassword } = await createFreshMember();
    await loginWithCredentials(page, username, initialPassword);
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
    await page.getByLabel("原密码", { exact: true }).fill(initialPassword);
    await page.getByLabel("新密码", { exact: true }).fill("short");
    await page.getByLabel("确认新密码", { exact: true }).fill("short");
    await page.getByRole("button", { name: "确认修改" }).click();
    await expect(page.locator("form p[role='alert']")).toContainText("密码长度至少 12 位");
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
  });

  test("change-password-success (AC-17): 提交合规新密码进入仪表盘，再用新密码登录直接进仪表盘", async ({ page }) => {
    requireApiUrl();
    const { username, initialPassword } = await createFreshMember();
    await loginWithCredentials(page, username, initialPassword);
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
    const newPassword = `${initialPassword}N2!`;
    await page.getByLabel("原密码", { exact: true }).fill(initialPassword);
    await page.getByLabel("新密码", { exact: true }).fill(newPassword);
    await page.getByLabel("确认新密码", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "确认修改" }).click();
    await expect(page).toHaveURL(/\/backdoor$/);
    // 登出后用新密码登录直接进仪表盘
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/backdoor\/login$/);
    await loginWithCredentials(page, username, newPassword);
    await expect(page).toHaveURL(/\/backdoor$/);
  });

  test("new-user-force-change (AC-18): 超管经 dialog 创建成员后，新账号初始密码登录落在改密页", async ({ page }) => {
    requireApiUrl();
    const accounts = getAccounts();
    // 超管登录后台 → 用户管理 dialog 创建成员 → 记录用户名与初始密码
    const run = Date.now().toString(36);
    const newUser = `e2e_nu_${run}`;
    const initialPassword = `E2e_InitNu_${run}Z9!`;
    await loginWithCredentials(page, accounts.superadmin.username, accounts.superadmin.password);
    await page.goto(`${BASE}/backdoor/users`);
    await page.getByRole("button", { name: /增加用户/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("用户名").fill(newUser);
    await page.getByLabel("初始密码").fill(initialPassword);
    await page.getByRole("button", { name: "创建用户" }).click();
    await expect(page.getByRole("status")).toContainText("已创建");
    // 关闭 dialog 后再登出（modal 遮罩会拦截顶栏点击）
    await page.getByRole("button", { name: "关闭" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // 登出，用新账号初始密码登录 → 落在改密页
    await page.getByRole("button", { name: "登出" }).click();
    await expect(page).toHaveURL(/\/backdoor\/login$/);
    await loginWithCredentials(page, newUser, initialPassword);
    await expect(page).toHaveURL(/\/backdoor\/change-password$/);
  });
});
