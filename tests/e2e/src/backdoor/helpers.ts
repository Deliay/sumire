import { expect, type Page } from "@playwright/test";
import type { Account } from "../tools/accounts";

/** 通过 UI 登录后台并进入仪表盘（适用于已完成改密的账号）。 */
export async function loginViaUi(page: Page, account: Account, baseURL: string): Promise<void> {
  await page.goto(`${baseURL}/backdoor/login`);
  await page.getByLabel("用户名").fill(account.username);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: "登录" }).click();
  // 等待登录后的 SPA 导航完成，确保会话 Cookie 与 me 状态已建立
  await expect(page).toHaveURL(/\/backdoor(\/.*)?$/);
  await expect(page.locator("form p[role='alert']")).toHaveCount(0);
}
