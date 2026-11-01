import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

const PAGES = ["/", "/about", "/assets", "/calendar"];

test.describe("视觉壳层（装订）", () => {
  for (const width of [375, 768, 1440]) {
    test(`visual-shell-${width}: 三档视口无横向滚动、main#main 与唯一 h1`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES) {
        await page.goto(`${BASE}${path}`);
        await page.waitForTimeout(500);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} @${width}`).toBeLessThanOrEqual(1);
        await expect(page.locator("main#main")).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      }
    });
  }

  test("skip link 为 Tab 首个焦点且指向 #main", async ({ page }) => {
    await page.goto(BASE);
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => ({
      text: document.activeElement?.textContent ?? "",
      href: document.activeElement?.getAttribute("href") ?? "",
    }));
    expect(active.text).toBe("跳到正文");
    expect(active.href).toBe("#main");
  });

  test("桌面装订线可见（/about PageShell border-left）", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/about`);
    const width = await page.evaluate(() => {
      const el = document.querySelector("main#main > div") as HTMLElement | null;
      return el ? Number.parseInt(getComputedStyle(el).borderLeftWidth, 10) : 0;
    });
    expect(width).toBeGreaterThanOrEqual(1);
  });

  test("PageIndex 页码可点击跳转（档案 · 喜好 → #archive-3）", async ({ page }) => {
    await page.goto(BASE);
    const rail = page.getByRole("navigation", { name: "页面位置" });
    await rail.getByRole("link", { name: "档案 · 喜好" }).click();
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#archive-3");
  });

  test("竖排书名：桌面 vertical-rl / 移动 horizontal-tb", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    const title = page.locator("[data-section='hero'] h1 span").first();
    expect(await title.evaluate((el) => getComputedStyle(el).writingMode)).toBe("vertical-rl");
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(300);
    expect(await title.evaluate((el) => getComputedStyle(el).writingMode)).toBe("horizontal-tb");
  });

  test("reduced-motion 下无 canvas、无雾气", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE);
    await expect(page.locator("canvas[aria-hidden='true']")).toHaveCount(0);
    await expect(page.locator(".fog")).toHaveCount(0);
  });

  test("移动端抽屉：Esc 关闭、关闭后焦点归还、body 滚动复原", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(BASE);
    const trigger = page.getByRole("button", { name: "打开菜单" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "站点导航" })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "站点导航" })).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });
});
