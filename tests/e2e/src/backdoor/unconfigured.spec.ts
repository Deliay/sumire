import { test, expect } from "@playwright/test";

const STATIC_BASE = process.env.BOOKSTORE_STATIC_BASE_URL;

const BACKDOOR_PATHS = [
  "/backdoor",
  "/backdoor/login",
  "/backdoor/users",
  "/backdoor/change-password",
  "/backdoor/schedule",
  "/backdoor/danmaku",
];

const UNCONFIGURED_PUBLIC_PATHS = ["/calendar"];

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
      // 后台导航整体不渲染，无弹幕看板（及其它后台页）入口
      await expect(page.getByRole("navigation", { name: "后台导航" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "弹幕看板" })).toHaveCount(0);
      expect(apiRequests).toEqual([]);
    });
  }

  for (const path of UNCONFIGURED_PUBLIC_PATHS) {
    test(`${path}（公开页）未配置时呈现站点 404 且不发起 /api 请求`, async ({ page }) => {
      const apiRequests: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("/api/")) apiRequests.push(req.url());
      });

      await page.goto(`${STATIC_BASE}${path}`);
      await expect(page.getByText("页面不存在")).toBeVisible();
      await expect(page.getByText("返回首页")).toBeVisible();
      expect(apiRequests).toEqual([]);
    });
  }

  test("/ 主页未配置时无本周日程入口", async ({ page }) => {
    await page.goto(`${STATIC_BASE}/`);
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /查看完整日历/ })).toHaveCount(0);
  });
});
