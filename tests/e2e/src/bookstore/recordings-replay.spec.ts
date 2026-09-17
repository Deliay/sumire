import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

const ROOM_ID = 1;
const FILE_NAME = "回放-01 中文.flv";
// 场次实际起止（info），createdAt 为分段结束时刻（刻意晚于 startedAt，用于验证锚点取 info 而非 createdAt）
const SESSION_START = "2026-09-28T10:00:00.000Z";
const SESSION_END = "2026-09-28T11:00:00.000Z";
const FILE_CREATED_AT = "2026-09-28T11:00:00.000Z";

const RECORDING_STATUS = {
  items: [
    {
      mid: 100,
      roomId: ROOM_ID,
      state: "recording",
      sessionTitle: "夜读会",
      updatedAt: "2026-09-28T10:00:00.000Z",
      streamer: { name: "枝堇" },
    },
  ],
};

function filesFixture() {
  return {
    files: [
      {
        name: FILE_NAME,
        size: 2048,
        createdAt: FILE_CREATED_AT,
        info: {
          recordingId: "rec-e2e",
          title: "夜读会",
          mid: 100,
          startedAt: SESSION_START,
          endedAt: SESSION_END,
        },
      },
    ],
  };
}

const SENDER = { uid: 1001, name: "观众", face: null, medal: null };

// 条目故意乱序下发，断言列表自行按 occurredAt 升序展示
const REPLAY_EVENTS = {
  total: 4,
  page: 1,
  pageSize: 100,
  items: [
    {
      eventId: "e3",
      type: "gift",
      occurredAt: "2026-09-28T10:00:25.000Z",
      sender: SENDER,
      price: 30,
      gift: { name: "小心心", count: 3 },
    },
    {
      eventId: "e1",
      type: "danmaku",
      occurredAt: "2026-09-28T10:00:05.000Z",
      sender: SENDER,
      content: "最早的弹幕",
    },
    {
      eventId: "e4",
      type: "guard_buy",
      occurredAt: "2026-09-28T10:00:35.000Z",
      sender: SENDER,
      price: 138,
      guard: { level: 3, name: "舰长", count: 1 },
    },
    {
      eventId: "e2",
      type: "super_chat",
      occurredAt: "2026-09-28T10:00:15.000Z",
      sender: SENDER,
      content: "SC 内容",
      price: 30,
      scColors: { backgroundStart: "#ffffff", backgroundEnd: "#ffffff", fontColor: "#000000" },
    },
  ],
};

/** 拦截录播服务四组端点（浏览器侧 mock，基址只需非空）。 */
async function mockRecordingsUpstream(page: Page, opts: { range?: boolean } = {}) {
  await page.route("**/api/b/live/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/recording-status")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RECORDING_STATUS) });
      return;
    }
    if (path.endsWith("/live-stream/audio")) {
      await route.fulfill({ status: 200, contentType: "video/x-flv", body: "" });
      return;
    }
    if (/\/recordings\/[^/]+$/.test(path)) {
      const hasRange = Boolean(route.request().headers()["range"]);
      if (opts.range !== false && hasRange) {
        await route.fulfill({
          status: 206,
          contentType: "video/x-flv",
          headers: { "Accept-Ranges": "bytes", "Content-Range": "bytes 0-0/0" },
          body: "",
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "video/x-flv", body: "" });
      return;
    }
    if (/\/recordings$/.test(path)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(filesFixture()) });
      return;
    }
    await route.continue();
  });
}

/**
 * 拦截本站公开事件 API（bookstore 对 `NEXT_PUBLIC_API_BASE_URL` 绝对基址直连，
 * 规则匹配全域名；跨域 mock 需显式回 CORS 头）。
 */
const REPLAY_EVENTS_GLOB = "**/api/live-events/replay*";

/** 记录回放事件请求 URL，供断言 roomId 透传。 */
const replayRequests: string[] = [];

async function mockReplayEvents(page: Page, opts: { status?: number } = {}) {
  const cors = { "Access-Control-Allow-Origin": "*" };
  await page.route(REPLAY_EVENTS_GLOB, async (route) => {
    replayRequests.push(route.request().url());
    if (opts.status && opts.status !== 200) {
      await route.fulfill({ status: opts.status, contentType: "application/json", headers: cors, body: "{}" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(REPLAY_EVENTS) });
  });
}

function replayUrl(): string {
  return `${BASE}/recordings/replay?roomId=${ROOM_ID}&file=${encodeURIComponent(FILE_NAME)}`;
}

test.describe("bookstore 回放页", () => {
  test("recordings-replay-elements: 三要素渲染（视频容器/事件列表/canvas 浮层）", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    await expect(page.getByRole("heading", { name: "录播回放" })).toBeVisible();
    // 场次标题来自文件 info
    await expect(page.getByText("夜读会")).toBeVisible();
    await expect(page.getByLabel("录播视频")).toBeVisible();
    await expect(page.getByRole("slider", { name: "播放进度" })).toBeVisible();
    await expect(page.getByRole("region", { name: "事件列表" })).toBeVisible();
    await expect(page.getByTestId("danmaku-overlay")).toBeVisible();
    // 下载入口在播放控制栏；舞台下方操作区与「弹幕事件」标题已移除
    await expect(page.getByRole("link", { name: "下载该场录播" })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回录播列表" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "弹幕事件" })).toHaveCount(0);
  });

  test("recordings-replay-room: 事件请求携带本页 roomId（不串到其它直播间）", async ({ page }) => {
    replayRequests.length = 0;
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    await expect(page.locator("[data-timeline-event]").first()).toBeVisible();
    expect(replayRequests.length).toBeGreaterThan(0);
    for (const url of replayRequests) {
      expect(new URL(url).searchParams.get("roomId")).toBe(String(ROOM_ID));
    }
  });

  test("recordings-replay-order: 事件条目按 occurredAt 升序展示", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    const items = page.locator("[data-timeline-event]");
    await expect(items).toHaveCount(4);
    const ids = await items.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-timeline-event")),
    );
    expect(ids).toEqual(["e1", "e2", "e3", "e4"]);
  });

  test("recordings-replay-seek: 点击事件条目后当前进度高亮跳转", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    const third = page.locator('[data-timeline-event="e3"]');
    await expect(page.locator('[data-timeline-event="e1"]')).toHaveAttribute("data-current", "true");

    await third.click();
    await expect(third).toHaveAttribute("data-current", "true");
    await expect(page.locator('[data-timeline-event="e1"]')).not.toHaveAttribute("data-current", "true");
  });

  test("recordings-replay-fullscreen: 网页全屏作用于舞台容器并锁定滚动，退出还原", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    const stage = page.getByTestId("replay-stage");
    await expect(stage).toHaveAttribute("data-fullscreen-mode", "none");

    await page.getByRole("button", { name: "网页全屏" }).click();
    await expect(stage).toHaveAttribute("data-fullscreen-mode", "web");
    await expect(stage).toHaveClass(/fixed/);
    await expect(stage).toHaveClass(/inset-0/);
    await expect(stage).toHaveClass(/z-50/);
    await expect(page.getByRole("region", { name: "事件列表" })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    // 全屏控制栏悬浮于视频容器内
    await expect(page.getByTestId("fullscreen-controls")).toBeVisible();

    // 播放区容器在受控 web 模式下不得再 fixed 铺满视口（否则会遮挡事件列表）
    const panelContainerClass = await page
      .locator('[data-fullscreen-container]')
      .first()
      .getAttribute("class");
    expect(panelContainerClass ?? "").not.toContain("fixed");
    // 事件列表中心点可被命中（未被播放区遮挡）
    const hitInsideTimeline = await page.evaluate(() => {
      const region = document.querySelector('[aria-label="事件列表"]');
      if (!region) return false;
      const rect = region.getBoundingClientRect();
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return !!el && region.contains(el);
    });
    expect(hitInsideTimeline).toBe(true);

    // 控制栏静止会自动隐藏；移动鼠标到视频上重新显现后再退出
    await page.locator("video").hover();
    await page.getByRole("button", { name: "退出网页全屏" }).click();
    await expect(stage).toHaveAttribute("data-fullscreen-mode", "none");
    await expect(stage).not.toHaveClass(/z-50/);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("recordings-replay-error: 事件 API 失败展示错误态与重试，视频区不受影响", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page, { status: 500 });
    await page.goto(replayUrl());

    await expect(page.getByText("弹幕事件加载失败。")).toBeVisible();
    await expect(page.getByLabel("录播视频")).toBeVisible();

    // 恢复成功通路后点击重试
    await page.unroute(REPLAY_EVENTS_GLOB);
    await mockReplayEvents(page);
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.locator("[data-timeline-event]")).toHaveCount(4);
    await expect(page.getByText("弹幕事件加载失败。")).toHaveCount(0);
  });

  test("recordings-replay-invalid: 参数非法时展示空态与返回入口", async ({ page }) => {
    await mockRecordingsUpstream(page);
    await mockReplayEvents(page);
    await page.goto(`${BASE}/recordings/replay`);

    await expect(page.getByText(/参数无效/)).toBeVisible();
    await expect(page.getByRole("link", { name: "返回录播列表" })).toHaveAttribute("href", "/recordings");
    await expect(page.getByLabel("录播视频")).toHaveCount(0);
  });

  test("recordings-replay-range-unsupported: Range 不支持时进度条禁用并明示", async ({ page }) => {
    await mockRecordingsUpstream(page, { range: false });
    await mockReplayEvents(page);
    await page.goto(replayUrl());

    await expect(page.getByText(/当前上游不支持拖动进度/)).toBeVisible();
    await expect(page.getByRole("slider", { name: "播放进度" })).toBeDisabled();
  });
});
