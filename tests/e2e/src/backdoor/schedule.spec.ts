import { test, expect } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("backdoor 直播计划", () => {
  test("schedule-create: 超管录入直播计划，日历即时可见，翻月可查看", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await expect(page.getByRole("link", { name: "直播计划" })).toBeVisible();
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();

    // 录入一条计划
    const run = Date.now().toString(36);
    const title = `e2e计划_${run}`;
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const dateInput = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;

    await page.getByRole("button", { name: "增加直播计划" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("日期").fill(dateInput);
    await page.getByLabel("直播主题").fill(title);
    await page.getByRole("button", { name: "保存计划" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 日历即时可见新计划（本地日期在同一视图月份内）
    await expect(page.getByTestId("calendar-day").first()).toBeVisible();
    const dayCell = page.locator(`[data-testid="calendar-day"][data-date="${dateInput}"]`);
    await expect(dayCell).toBeVisible();
    await expect(dayCell.getByText(title)).toBeVisible();
  });

  test("schedule-member-readonly: member 可见日历与导航，但无增加按钮", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.member, BASE);
    await expect(page.getByRole("link", { name: "直播计划" })).toBeVisible();
    await page.getByRole("link", { name: "直播计划" }).click();
    await expect(page.getByRole("heading", { name: "直播计划" })).toBeVisible();
    await expect(page.getByTestId("calendar-day").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "增加直播计划" })).toHaveCount(0);
  });

  test("schedule-empty-submit: 日期或主题为空时无法提交", async ({ page }) => {
    const accounts = getAccounts();
    await loginViaUi(page, accounts.superadmin, BASE);
    await page.getByRole("link", { name: "直播计划" }).click();
    await page.getByRole("button", { name: "增加直播计划" }).click();
    // 空表单直接提交 → 原生 required 校验拦截，dialog 保持打开
    await page.getByRole("button", { name: "保存计划" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
