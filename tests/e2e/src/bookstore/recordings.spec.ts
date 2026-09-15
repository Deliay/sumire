import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

const RECORDING_STATUS = {
  items: [
    {
      mid: 100,
      roomId: 1,
      state: "recording",
      sessionTitle: "夜读会",
      updatedAt: "2026-09-14T12:00:00.000Z",
      streamer: { name: "枝堇" },
    },
    {
      mid: 200,
      roomId: 2,
      state: "not_live",
      sessionTitle: null,
      updatedAt: "2026-09-14T11:00:00.000Z",
      streamer: { name: "另一间" },
    },
  ],
};

function filesFixture(count: number) {
  return {
    files: Array.from({ length: count }, (_, i) => ({
      name: `回放-${String(i + 1).padStart(2, "0")} 中文.flv`,
      size: 1024 * (i + 1),
      // 序号越小创建时间越新，保证倒序后 回放-01 在首屏
      createdAt: `2026-09-${String(28 - i).padStart(2, "0")}T10:00:00.000Z`,
    })),
  };
}

/** 拦截录播服务四组端点（浏览器侧 mock，基址只需非空）。 */
async function mockRecordingsUpstream(page: Page, opts: { status?: number; fileCount?: number } = {}) {
  await page.route("**/api/b/live/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/recording-status")) {
      if (opts.status && opts.status !== 200) {
        await route.fulfill({ status: opts.status, contentType: "application/json", body: "{}" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RECORDING_STATUS) });
      return;
    }
    if (path.endsWith("/live-stream/audio")) {
      await route.fulfill({ status: 200, contentType: "video/x-flv", body: "" });
      return;
    }
    if (/\/recordings\/[^/]+$/.test(path)) {
      await route.fulfill({ status: 200, contentType: "video/x-flv", body: "" });
      return;
    }
    if (/\/recordings$/.test(path)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(filesFixture(opts.fileCount ?? 21)),
      });
      return;
    }
    await route.continue();
  });
}

test.describe("bookstore 录播页", () => {
  test("recordings-nav: 导航「录播」进入 /recordings 且呈现选中态", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(BASE);
    await page.locator("header ul").first().getByRole("link", { name: "录播" }).click();
    await expect(page).toHaveURL(/\/recordings$/);
    await expect(page.getByRole("heading", { name: "录播", exact: true })).toBeVisible();
    const navLink = page.locator("header ul").first().getByRole("link", { name: "录播" });
    await expect(navLink).toHaveAttribute("aria-current", "page");
  });

  test("recordings-status: 渲染多直播间状态、录制中房间可听直播", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(`${BASE}/recordings`);
    const status = page.locator('section[aria-labelledby="recording-status-heading"]');
    await expect(status.getByText("枝堇")).toBeVisible();
    await expect(status.getByText("另一间")).toBeVisible();
    await expect(status.getByText("录制中")).toBeVisible();
    await expect(status.getByText("未在直播")).toBeVisible();
    // 仅录制中房间有「听直播」
    await expect(status.getByRole("button", { name: "听直播" })).toHaveCount(1);
  });

  test("recordings-groups: 折叠展开加载文件列表、翻页不重复请求", async ({ page }) => {
    await mockRecordingsUpstream(page, { fileCount: 21 });
    const listRequests: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/b\/live\/\d+\/recordings$/.test(new URL(req.url()).pathname)) listRequests.push(req.url());
    });

    await page.goto(`${BASE}/recordings`);
    const header = page.getByRole("button", { name: /枝堇/ });
    await expect(header).toHaveAttribute("aria-expanded", "false");

    await header.click();
    await expect(page.getByText("回放-01 中文.flv")).toBeVisible();
    await expect(page.getByText("第 1 / 2 页")).toBeVisible();
    await expect.poll(() => listRequests.length).toBe(1);

    await page.getByRole("button", { name: "下一页" }).click();
    await expect(page.getByText("回放-21 中文.flv")).toBeVisible();
    await expect(page.getByText("第 2 / 2 页")).toBeVisible();
    // 翻页为本地 slice，不重新请求
    expect(listRequests.length).toBe(1);
  });

  test("recordings-download: 下载入口收于下拉菜单，链接指向编码后的录播文件 URL", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(`${BASE}/recordings`);
    await page.getByRole("button", { name: /枝堇/ }).click();

    // 文件行不再直接渲染裸下载链接
    await expect(page.getByRole("link", { name: "下载" })).toHaveCount(0);

    await page.getByRole("button", { name: "更多操作" }).first().click();
    const download = page.getByRole("menuitem", { name: "下载" }).first();
    const href = await download.getAttribute("href");
    expect(href).toContain("/api/b/live/1/recordings/");
    expect(href).toContain(encodeURIComponent("回放-01 中文.flv"));
    await expect(download).toHaveAttribute("download", "");
  });

  test("recordings-play-actions: 主按钮展开/收起播放区，按钮文案随展开态变化", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(`${BASE}/recordings`);
    await page.getByRole("button", { name: /枝堇/ }).click();

    const playButton = page.getByRole("button", { name: "播放", exact: true }).first();
    await playButton.click();

    const panel = page.getByRole("region", { name: "录播播放区" });
    await expect(panel).toBeVisible();
    const collapseButton = page.getByRole("button", { name: "收起", exact: true }).first();
    await expect(collapseButton).toBeVisible();

    await collapseButton.click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: "播放", exact: true }).first()).toBeVisible();
  });

  test("recordings-preview: 点击文件项内联展开视频播放区与进度条", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(`${BASE}/recordings`);
    await page.getByRole("button", { name: /枝堇/ }).click();
    const fileRow = page.getByRole("button", { name: "回放-01 中文.flv" });
    await fileRow.click();

    await expect(fileRow).toHaveAttribute("aria-expanded", "true");
    const panel = page.getByRole("region", { name: "录播播放区" });
    await expect(panel).toContainText("回放-01 中文.flv");
    // 视频画面可见（非 hidden）
    await expect(panel.getByLabel("录播视频")).toBeVisible();
    // 可拖动进度条与音量
    await expect(panel.getByRole("slider", { name: "播放进度" })).toBeVisible();
    await expect(panel.getByRole("slider", { name: "音量" })).toBeVisible();
  });

  test("recordings-preview-accordion: 同一时间仅一个播放区，点击另一文件项前一个自动折叠", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await page.goto(`${BASE}/recordings`);
    await page.getByRole("button", { name: /枝堇/ }).click();

    const first = page.getByRole("button", { name: "回放-01 中文.flv" });
    const second = page.getByRole("button", { name: "回放-02 中文.flv" });
    await first.click();
    await expect(page.getByRole("region", { name: "录播播放区" })).toHaveCount(1);

    await second.click();
    await expect(page.getByRole("region", { name: "录播播放区" })).toHaveCount(1);
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("region", { name: "录播播放区" })).toContainText("回放-02 中文.flv");

    // 再次点击当前文件项折叠
    await second.click();
    await expect(page.getByRole("region", { name: "录播播放区" })).toHaveCount(0);
    await expect(second).toHaveAttribute("aria-expanded", "false");
  });

  test("recordings-degrade: recording-status 5xx 时展示空态不白屏", async ({ page }) => {
    await mockRecordingsUpstream(page, { status: 500 });
    await page.goto(`${BASE}/recordings`);
    await expect(page.getByText(/录播服务暂时不可用/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "录播", exact: true })).toBeVisible();
  });
});
