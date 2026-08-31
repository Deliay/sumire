import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore 主页（一屏封面页）", () => {
  test("site-home-onescreen: 首页一屏不可纵向滚动", async ({ page }) => {
    await page.goto(BASE);
    const scrollable = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollHeight: doc.scrollHeight, clientHeight: doc.clientHeight };
    });
    expect(scrollable.scrollHeight).toBeLessThanOrEqual(scrollable.clientHeight + 1);
  });

  test("site-home-content: 文案块与 bio 可见，无入口卡/速览条/本周日程", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/)).toBeVisible();
    await expect(page.getByText(/是老书屋的一株藤蔓/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "枝堇" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "主播档案" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "周边素材" })).toHaveCount(0);
    await expect(page.getByText(/了解更多 →/)).toHaveCount(0);
  });

  test("site-home-footer: 右下角单行 footer 含三个外链", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("link", { name: /B 站空间/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /直播间/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /萌娘百科/ })).toBeVisible();
    // 不再有应援色行
    await expect(page.getByText(/应援色/)).toHaveCount(0);
  });

  test("site-home-live-status: 直播状态组件存在且链接指向直播间", async ({ page }) => {
    await page.goto(BASE);
    const link = page.getByRole("link", { name: /直播中|未开播|直播状态/ });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "https://live.bilibili.com/1727076670");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("site-home-today: 今日日程组件存在（有计划或空态）", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("heading", { name: "今日日程" })).toBeVisible();
  });

  test("site-about-fields: /about 展示新增喜好字段", async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await expect(page.getByText("通俗文学")).toBeVisible();
    await expect(page.getByText("东方系列")).toBeVisible();
    await expect(page.getByText("模拟经营")).toBeVisible();
    await expect(page.getByText("小姨驾到")).toBeVisible();
  });

  test("site-calendar-regression: /calendar 回归可用", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
  });
});