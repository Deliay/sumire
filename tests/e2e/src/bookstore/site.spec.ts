import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore 主页（整页滚动叙事容器）", () => {
  test("site-home-scroll: 首页首屏为 hero 站，wheel 翻页后进入档案站", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/).first()).toBeVisible();
    await page.mouse.wheel(0, 500);
    await expect(page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first()).toBeVisible();
  });

  test("site-home-content: 文案块与 bio 可见，无入口卡/速览条/本周日程", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/).first()).toBeVisible();
    await expect(page.getByText(/是老书屋的一株藤蔓/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "枝堇" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    await expect(page.getByText(/了解更多 →/)).toHaveCount(0);
  });

  test("site-home-indicator: 存在位置指示器（SectionRail）", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole("navigation", { name: "页面位置" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "页面位置" }).getByText("档案")).toBeVisible();
  });

  test("site-home-nav-click: 首页内点击导航「档案」锚点平滑翻页至档案站", async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole("link", { name: "档案" }).first().click();
    await expect(page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first()).toBeVisible();
  });

  test("site-home-nav-active: 翻页后导航选中态同步（点击导航到素材站 → 素材高亮）", async ({ page }) => {
    await page.goto(BASE);
    // 桌面导航 ul（header 内 md:flex，排除移动端菜单的重复 link）
    const nav = page.locator("header ul").first();
    // 点击导航「素材」锚点：deck 监听 hashchange → goTo → SECTION_CHANGE_EVENT 同步 nav 选中态
    await nav.getByRole("link", { name: "素材" }).click();
    await expect(nav.getByRole("link", { name: "素材" })).toHaveAttribute("aria-current", "page");
    // 其余导航项不再高亮
    for (const label of ["主页", "档案", "日历"]) {
      await expect(nav.getByRole("link", { name: label })).not.toHaveAttribute("aria-current", "page");
    }
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

  test("site-home-mobile-scrollable: 移动端档案内容列内真实触控上滑滚动内容且 hash 不变", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(`${BASE}/#archive-2`);
    await page.waitForTimeout(900);
    // 仅当前档案屏（archive-2）的内容列（5 个档案屏各有一列，须限定到当前站）
    const scrollable = page.locator("[data-section='archive-2'] [data-fullpage-scrollable]");
    await expect(scrollable).toHaveCount(1);
    const beforeHash = await page.evaluate(() => window.location.hash);
    const box = await scrollable.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const startY = box.y + box.height - 30;
    // 用 CDP 派发真实触控拖拽序列：touchStart → 分步 touchMove（每步 25px 上滑）→ touchEnd
    const client = await page.context().newCDPSession(page);
    const steps = 10;
    const stepDy = 25;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx, y: startY }],
    });
    for (let i = 1; i <= steps; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: cx, y: startY - i * stepDy }],
      });
      await page.waitForTimeout(20);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    const scrollTop = await scrollable.evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
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
    // 立绘 <img> 仍在（alt 为素材标题）——限定在首页站（hero）的视差层内
    await expect(page.locator("[data-section='hero'] img[alt*='枝堇立绘']")).toBeVisible();
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