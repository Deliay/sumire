import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore 主页（整页滚动叙事容器）", () => {
  test("site-home-scroll: 首页首屏为 hero 站，wheel 翻页后进入档案站", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/)).toBeVisible();
    await page.mouse.wheel(0, 500);
    await expect(page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first()).toBeVisible();
  });

  test("site-home-content: 文案块与 bio 可见，无入口卡/速览条/本周日程", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/)).toBeVisible();
    await expect(page.getByText(/是老书屋的一株藤蔓/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "枝堇" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    await expect(page.getByText(/了解更多 →/)).toHaveCount(0);
  });

  test("site-home-indicator: 存在位置指示器（SectionRail）", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("navigation", { name: "页面位置" })).toBeVisible();
    await expect(page.getByText("档案")).toBeVisible();
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

  test("site-home-visual-fx: 首页存在常驻光晕粒子 canvas（fixed）与立绘视差层", async ({ page }) => {
    await page.goto(BASE);
    const canvas = page.locator('canvas[aria-hidden="true"]');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveClass(/pointer-events-none/);
    await expect(canvas).toHaveClass(/fixed/);
    // 立绘 <img> 仍在（alt 为素材标题）
    await expect(page.locator('img[alt*="枝堇立绘"]')).toBeVisible();
  });

  test("site-home-visual-fx-reduce: reduced-motion 下粒子 canvas 仍存在（降级保留渲染）", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE);
    const canvas = page.locator('canvas[aria-hidden="true"]');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveClass(/pointer-events-none/);
  });

  test("site-about-fields: /about 展示五组档案内容", async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await expect(page.getByText("通俗文学")).toBeVisible();
    await expect(page.getByText("东方系列")).toBeVisible();
    await expect(page.getByText("模拟经营")).toBeVisible();
    await expect(page.getByText("小姨驾到")).toBeVisible();
    await expect(page.getByText("传送门")).toBeVisible();
  });

  test("site-calendar-regression: /calendar 回归可用", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
  });
});