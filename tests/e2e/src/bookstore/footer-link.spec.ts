import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore footer link", () => {
  test("bookstore-footer-link (AC-12~14): 页脚右下角「管理 →」指向 /backdoor，点击落在登录页", async ({ page }) => {
    await page.goto(`${BASE}/`);
    const link = page.getByRole("link", { name: /管理/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/backdoor");
    await link.click();
    await expect(page).toHaveURL(/\/backdoor/);
  });
});
