import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore footer link", () => {
  for (const path of ["/", "/about", "/assets"]) {
    test(`公开站 ${path} 不出现指向 /backdoor 的链接`, async ({ page }) => {
      await page.goto(`${BASE}${path}`);
      await expect(page.getByRole("link", { name: /管理/ })).toHaveCount(0);
      await expect(page.locator('a[href="/backdoor"]')).toHaveCount(0);
    });
  }
});
