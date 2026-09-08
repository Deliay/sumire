import { expect, test } from "@playwright/test";

test.describe("主页", () => {
  test("展示品牌与入口", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/堇色书屋/);
    await expect(
      page.getByRole("heading", { name: /枝堇/ }),
    ).toBeVisible();
    await expect(page.getByText("是老书屋的一株藤蔓")).toBeVisible();
    // 整页滚动叙事：导航为锚点入口（档案/素材）
    await expect(
      page.getByRole("banner").getByRole("link", { name: "档案" }),
    ).toBeVisible();
    await expect(
      page.getByRole("banner").getByRole("link", { name: "素材" }),
    ).toBeVisible();
    // 素材站尾部流式 Footer 内直播间外链
    await expect(
      page.getByRole("main").getByRole("link", { name: "直播间", exact: true }),
    ).toHaveAttribute("href", /live\.bilibili\.com/);
  });

  test("不显示未上线功能的占位入口", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/敬请期待/)).toHaveCount(0);
  });
});

test.describe("档案页", () => {
  test("展示档案信息、历程与链接", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByRole("heading", { name: "枝堇图鉴" }),
    ).toBeVisible();
    await expect(page.getByText("小粉螈")).toBeVisible();
    await expect(page.getByText("天雨Rainfall")).toBeVisible();
    await expect(page.getByText("2026-08-07")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /B 站直播间/ }),
    ).toHaveAttribute("href", /live\.bilibili\.com/);
  });
});

test.describe("素材库", () => {
  test("展示版权声明、筛选与下载", async ({ page }) => {
    await page.goto("/assets");
    await expect(
      page.getByRole("main").getByText(/非官方粉丝作品/).first(),
    ).toBeVisible();

    // 分类筛选
    await page
      .getByRole("group", { name: "素材分类" })
      .getByRole("button", { name: "宣传图" })
      .click();
    await expect(page.getByText("枝堇立绘 ①（持书）")).toHaveCount(0);
    await expect(page.getByText("出道月大航海回馈")).toBeVisible();

    // Lightbox 与下载
    await page.getByRole("button", { name: /出道月大航海回馈/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: /下载原图/ }),
    ).toHaveAttribute("href", /\/assets\/original\/.+\.png/);

    // Esc 关闭
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("移动端", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("主页与导航可用", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /枝堇/ }),
    ).toBeVisible();
    // 打开移动端菜单，点击「档案」锚点翻页至档案首屏
    await page.getByRole("button", { name: "打开菜单" }).click();
    await page
      .getByRole("banner")
      .getByRole("link", { name: "档案", exact: true })
      .click();
    await expect(page).toHaveURL(/#archive-1/);
    await expect(
      page.getByText(/信息 · Profile|设定 · Story|喜好 · Taste/).first(),
    ).toBeVisible();
  });
});
