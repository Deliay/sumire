import { test, expect } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

test.describe("bookstore 主页（整页滚动叙事容器）", () => {
  test("site-home-scroll: 首页首屏为 hero 站，wheel 翻页后进入档案站", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/).first()).toBeVisible();
    await page.mouse.wheel(0, 500);
    await expect(page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first()).toBeVisible();
  });

  test("site-home-scroll-slow-notch: 慢速单格滚轮（间隔>150ms、<100px）一次翻一屏", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(600);
    // 单格 53px，间隔 400ms 慢速逐格：每格即翻一屏
    await page.mouse.wheel(0, 53);
    await page.waitForTimeout(600);
    const hash1 = await page.evaluate(() => window.location.hash);
    await page.mouse.wheel(0, 53);
    await page.waitForTimeout(600);
    const hash2 = await page.evaluate(() => window.location.hash);
    // 两次慢速单格应翻两屏
    expect(hash1).toBe("#archive-1");
    expect(hash2).toBe("#archive-2");
  });

  test("site-home-calendar-exit: 桌面日历站滚轮可下翻进素材、上翻回档案（不因滚动标记被困）", async ({ page }) => {
    await page.goto(`${BASE}/#calendar`);
    await page.waitForTimeout(1200);
    // 下翻：日历站 → 素材站
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#assets");
    // 上翻：素材站 → 回日历站
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#calendar");
    // 再上翻：日历站 → 档案 P5
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#archive-5");
  });

  test("site-home-content: 文案块与 bio 可见，无入口卡/速览条/本周日程", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByText(/VirtuaReal · 二十八期/).first()).toBeVisible();
    await expect(page.getByText(/是老书屋的一株藤蔓/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "枝堇" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "本周日程" })).toHaveCount(0);
    await expect(page.getByText(/了解更多 →/)).toHaveCount(0);
  });

  test("site-home-indicator: 存在位置指示器（SectionRail，仅圆点无文字）", async ({ page }) => {
    await page.goto(BASE);
    const rail = page.getByRole("navigation", { name: "页面位置" });
    await expect(rail).toBeVisible();
    // 指示器仅圆点节点（无文字），用 aria-label 定位「档案」主节点
    await expect(rail.getByRole("link", { name: "档案" })).toBeVisible();
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

  test("site-home-visual-fx-reduce: reduced-motion 下粒子/翻页/雾气与常规一致（不降级）", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE);
    await page.waitForTimeout(1000);
    const canvas = page.locator('canvas[aria-hidden="true"]');
    await expect(canvas).toHaveCount(1);
    await expect(canvas).toHaveClass(/pointer-events-none/);
    // 公开站氛围层不降级：reduced 下首页雾气仍带漂移动画（非 animation:none）
    const fogAnim = await page
      .locator(".fog-a")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(fogAnim).not.toBe("none");
    // 展示向氛围层不降级：reduced 下仍可滚轮翻页（转场正常）
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.location.hash)).toBe("#archive-1");
  });

  test("site-home-archive-webp: 档案屏大屏立绘 webp 均正常加载（无 404）", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 400 && res.url().includes("/assets/original/")) failed.push(res.url());
    });
    await page.goto(`${BASE}/#archive-5`);
    await page.waitForTimeout(1200);
    // 逐个翻页遍历档案屏，触发各屏大屏立绘 lazy 加载
    for (const id of ["archive-5", "archive-4", "archive-3", "archive-2", "archive-1"]) {
      await page.evaluate((sid) => {
        window.history.pushState(null, "", `#${sid}`);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }, id);
      await page.waitForTimeout(700);
    }
    // 各档案屏大屏立绘 img（original webp）应有加载（DOM 中 standing/illustration 的 original 图）
    const portraitImgs = page.locator("[data-section^='archive'] img[src*='/assets/original/']");
    await expect(portraitImgs.first()).toHaveCount(1);
    expect(failed).toEqual([]);
  });

  test("site-home-archive-bleed: 档案屏立绘底边与窗口底边齐平（gap=0）", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/#archive-1`);
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const img = document.querySelector("[data-section='archive-1'] img[src*='/assets/original/']");
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { bottom: r.bottom, innerHeight: window.innerHeight };
    });
    expect(info).toBeTruthy();
    if (info) {
      // 立绘底边应贴齐视口底（允许 ≤2px 容差）
      expect(Math.abs(info.innerHeight - info.bottom)).toBeLessThanOrEqual(2);
    }
  });

  test("site-about-fields: /about 展示五组档案内容与分栏立绘", async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await expect(page.getByText("通俗文学")).toBeVisible();
    await expect(page.getByText("东方系列")).toBeVisible();
    await expect(page.getByText("模拟经营")).toBeVisible();
    await expect(page.getByText("小姨驾到")).toBeVisible();
    await expect(page.getByText("传送门")).toBeVisible();
    // 五部分均带大屏立绘（original webp，无 404）
    const portraits = page.locator("img[src*='/assets/original/']");
    expect(await portraits.count()).toBeGreaterThanOrEqual(5);
    const failed: string[] = [];
    page.on("response", (res) => {
      if (res.status() >= 400 && res.url().includes("/assets/original/")) failed.push(res.url());
    });
    await page.waitForTimeout(500);
    expect(failed).toEqual([]);
  });

  test("site-calendar-regression: /calendar 回归可用", async ({ page }) => {
    await page.goto(`${BASE}/calendar`);
    await expect(page.getByRole("heading", { name: "直播日程" })).toBeVisible();
  });

  test("site-home-free-reclaim: free 模式顶部（scrollTop=0）上滚直接回收回日历站，键盘↑亦回收", async ({ page }) => {
    await page.goto(`${BASE}/#assets`);
    await page.waitForTimeout(1200);
    // 进入 free 模式（素材站容器 overflow auto），scrollTop 尚未下滚
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(600);
    // 立即上滚（顶部未下滚，无 scroll 事件）→ 回收上翻回日历站
    await page.mouse.wheel(0, -800);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#calendar");

    // 再次进入 free 并键盘 ↑ 回收
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#assets");
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.location.hash)).toBe("#calendar");
  });
});