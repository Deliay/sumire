import { test, expect } from "@playwright/test";

const STATIC_BASE = process.env.BOOKSTORE_STATIC_BASE_URL;

const BACKDOOR_PATHS = [
  "/backdoor",
  "/backdoor/login",
  "/backdoor/users",
  "/backdoor/change-password",
];

test.describe("backdoor 未配置形态 404", () => {
  test.skip(
    !STATIC_BASE,
    "未配置 BOOKSTORE_STATIC_BASE_URL，跳过未配置形态 e2e（经 `pnpm test:unconfigured` 单独触发）",
  );

  for (const path of BACKDOOR_PATHS) {
    test(`${path} 呈现站点 404 且不发起 /api 请求`, async ({ page }) => {
      const apiRequests: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("/api/")) apiRequests.push(req.url());
      });

      await page.goto(`${STATIC_BASE}${path}`);
      await expect(page.getByText("页面不存在")).toBeVisible();
      await expect(page.getByText("返回首页")).toBeVisible();
      await expect(page.getByLabel("用户名")).toHaveCount(0);
      expect(apiRequests).toEqual([]);
    });
  }
});
