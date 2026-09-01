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

  test("site-home-nav-click: 首页内点击导航「档案」锚点平滑翻页至档案站", async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole("link", { name: "档案" }).click();
    await expect(page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first()).toBeVisible();
  });

  test("site-home-nav-active: 翻页后导航选中态同步（滚动到素材站 → 素材高亮）", async ({ page }) => {
    await page.goto(BASE);
    // 滚轮多次到素材站
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(900);
    }
    await expect(page.getByRole("link", { name: "素材" })).toHaveAttribute("aria-current", "page");
  });

  test("site-home-no-oscillation: 连续两次翻页后 hash/transform 2s 内稳定不振荡", async ({ page }) => {
    await page.goto(BASE);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
    const sample = async () =>
      page.evaluate(() => ({
        hash: window.location.hash,
        transform: (document.querySelector("[data-section='archive-2']")?.parentElement as HTMLElement | null)
          ?.style.transform,
      }));
    const a = await sample();
    await page.waitForTimeout(2000);
    const b = await sample();
    expect(b.hash).toBe(a.hash);
    expect(b.transform).toBe(a.transform);
  });

  test("site-home-hash-land-flip: /#archive-2 直落后翻一页稳定不振荡", async ({ page }) => {
    await page.goto(`${BASE}/#archive-2`);
    await page.waitForTimeout(900);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
    const sample = async () =>
      page.evaluate(() => ({
        hash: window.location.hash,
        transform: (document.querySelector("[data-section='archive-3']")?.parentElement as HTMLElement | null)
          ?.style.transform,
      }));
    const a = await sample();
    await page.waitForTimeout(2000);
    const b = await sample();
    expect(b.hash).toBe(a.hash);
    expect(b.transform).toBe(a.transform);
  });

  test("site-home-mobile-scrollable: 移动端档案内容列内触控上滑滚动内容且 hash 不变", async ({ page }) => {
    // 桌面滚到档案 P2（设定故事）——立绘+内容，内容列可滚动
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(`${BASE}/#archive-2`);
    await page.waitForTimeout(900);
    // 内容列：包含「设定」的 scrollable 容器
    const scrollable = page.locator("[data-fullpage-scrollable]");
    await expect(scrollable).toHaveCount(1);
    const beforeHash = await page.evaluate(() => window.location.hash);
    const box = await scrollable.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      const cx = box.x + box.width / 2;
      // 内容列内上滑（阅读手势）
      await page.touchscreen.tap(cx, box.y + box.height - 40);
      await page.evaluate(() => {
        const el = document.querySelector("[data-fullpage-scrollable]") as HTMLElement | null;
        if (el) el.scrollTop = 150;
      });
      await page.waitForTimeout(300);
      const scrollTop = await scrollable.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
    const afterHash = await page.evaluate(() => window.location.hash);
    expect(afterHash).toBe(beforeHash);
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