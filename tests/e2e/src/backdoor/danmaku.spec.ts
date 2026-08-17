import { test, expect, type Locator, type Page } from "@playwright/test";
import { getAccounts } from "../tools/accounts";
import { loginViaUi } from "./helpers";

const BASE = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000";

type LiveEventType = "danmaku" | "super_chat" | "gift" | "guard_buy";

/** 归一化 LiveEvent mock 体（契约 contract/live-events.openapi.yaml 的 LiveEvent schema）。 */
interface MockLiveEvent {
  eventId: string;
  type: LiveEventType;
  occurredAt: string;
  sender: {
    uid: number;
    name: string;
    nameRomaji: string | null;
    face: string | null;
    medal: { name: string; level: number; color: string } | null;
    guardLevel: number | null;
  };
  content?: string;
  contentRomaji?: string;
  price?: number;
  scColors?: { backgroundStart: string; backgroundEnd: string; fontColor: string };
  gift?: { name: string; count: number };
  guard?: { level: number; name: string; count: number };
  read: boolean;
}

let uidSeq = 100000;

function senderOf(name: string): MockLiveEvent["sender"] {
  // face 一律 null：走缺头像兜底渲染，避免 e2e 发起外网图片请求
  return { uid: uidSeq++, name, nameRomaji: null, face: null, medal: { name: "枝枝", level: 21, color: "#b4a6bf" }, guardLevel: null };
}

function danmakuEvent(eventId: string, content: string, guardLevel: number | null = null): MockLiveEvent {
  return {
    eventId,
    type: "danmaku",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    sender: { ...senderOf(`弹幕用户${eventId}`), guardLevel },
    content,
    read: false,
  };
}

function scEvent(eventId: string, content: string): MockLiveEvent {
  return {
    eventId,
    type: "super_chat",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    sender: senderOf(`SC用户${eventId}`),
    content,
    price: 100,
    scColors: { backgroundStart: "#EDF5FF", backgroundEnd: "#E6F0FF", fontColor: "#333333" },
    read: false,
  };
}

function giftEvent(eventId: string, giftName: string): MockLiveEvent {
  return {
    eventId,
    type: "gift",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    sender: senderOf(`礼物用户${eventId}`),
    gift: { name: giftName, count: 1 },
    price: 0.1,
    read: false,
  };
}

function guardEvent(eventId: string): MockLiveEvent {
  return {
    eventId,
    type: "guard_buy",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    sender: senderOf(`上船用户${eventId}`),
    guard: { level: 3, name: "舰长", count: 1 },
    price: 138,
    read: false,
  };
}

interface LiveEventStub {
  /** 已拦截到的已读写接口请求 URL（read / unread / read-all），用于断言写行为发生或未发生。 */
  writes: string[];
  /** 经 mock EventSource 向页面推一条实时事件（SSE data 帧）。 */
  push: (event: MockLiveEvent) => Promise<void>;
  /** 令匹配类型的检索接口返回 502（模拟上游不可用）；传 null 恢复 200。 */
  setRangeDown: (types: LiveEventType[] | null) => void;
}

/**
 * 以 page.route 拦截 live-events 域全部请求（glob 前缀匹配 /api/live-events 及其子路径，照历史直播用例范式，不依赖内网上游）：
 * - GET 检索：按 type 查询参数过滤夹具，并合并测试进程内维护的已读状态（page.route 跨 reload 生效，
 *   故「刷新后保持」可断言）；
 * - POST read/unread/read-all：维护同一状态；
 * - SSE：以 addInitScript 注入 EventSource 测试替身，经 window.__pushLiveEvent 推帧。
 */
async function stubLiveEvents(page: Page, events: MockLiveEvent[]): Promise<LiveEventStub> {
  const readState = new Map<string, boolean>();
  const writes: string[] = [];
  let rangeDownTypes: LiveEventType[] | null = null;

  await page.addInitScript(() => {
    interface FakeES {
      readyState: number;
      onopen: (() => void) | null;
      onmessage: ((msg: { data: string }) => void) | null;
      onerror: (() => void) | null;
      close: () => void;
    }
    const instances = new Set<FakeES>();
    class FakeEventSource implements FakeES {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readyState = 0;
      onopen: (() => void) | null = null;
      onmessage: ((msg: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(
        public readonly url: string,
        _opts?: unknown,
      ) {
        instances.add(this);
        setTimeout(() => {
          if (this.readyState === 0) {
            this.readyState = 1;
            this.onopen?.();
          }
        }, 0);
      }
      close() {
        this.readyState = 2;
        instances.delete(this);
      }
    }
    const w = window as unknown as {
      EventSource: unknown;
      __pushLiveEvent: (event: unknown) => void;
    };
    w.__pushLiveEvent = (event: unknown) => {
      for (const es of instances) {
        if (es.readyState === 1) es.onmessage?.({ data: JSON.stringify(event) });
      }
    };
    w.EventSource = FakeEventSource;
  });

  await page.route("**/api/live-events**", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const fulfillJson = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (req.method() === "GET" && url.pathname === "/api/live-events") {
      const types = url.searchParams.getAll("type");
      if (rangeDownTypes && types.some((t) => (rangeDownTypes as string[]).includes(t))) {
        return fulfillJson(502, { error: "上游事件服务不可用" });
      }
      const items = events
        .filter((e) => types.length === 0 || types.includes(e.type))
        .map((e) => ({ ...e, read: readState.get(e.eventId) ?? e.read }));
      return fulfillJson(200, { total: items.length, page: 1, pageSize: 50, items });
    }
    if (req.method() === "POST" && url.pathname === "/api/live-events/read") {
      writes.push(req.url());
      const body = req.postDataJSON() as { eventId?: string };
      if (body.eventId) readState.set(body.eventId, true);
      return fulfillJson(200, { ok: true });
    }
    if (req.method() === "POST" && url.pathname === "/api/live-events/unread") {
      writes.push(req.url());
      const body = req.postDataJSON() as { eventId?: string };
      if (body.eventId) readState.set(body.eventId, false);
      return fulfillJson(200, { ok: true });
    }
    if (req.method() === "POST" && url.pathname === "/api/live-events/read-all") {
      writes.push(req.url());
      const body = req.postDataJSON() as { type?: string };
      let marked = 0;
      for (const e of events) {
        if (e.type === body.type && !(readState.get(e.eventId) ?? e.read)) {
          readState.set(e.eventId, true);
          marked += 1;
        }
      }
      return fulfillJson(200, { ok: true, marked });
    }
    return fulfillJson(404, { error: `未 mock 的端点: ${req.method()} ${url.pathname}` });
  });

  return {
    writes,
    setRangeDown: (types) => {
      rangeDownTypes = types;
    },
    push: (event) =>
      page.evaluate(
        (e) => (window as unknown as { __pushLiveEvent: (ev: unknown) => void }).__pushLiveEvent(e),
        event,
      ),
  };
}

/** 视口内最顶部可见条目（含其相对容器顶部的偏移）。 */
function topVisibleItem(feed: Locator): Promise<{ text: string; offset: number } | null> {
  return feed.evaluate((el) => {
    const cTop = el.getBoundingClientRect().top;
    const cBottom = el.getBoundingClientRect().bottom;
    for (const item of Array.from(el.querySelectorAll<HTMLElement>("[data-index]"))) {
      const r = item.getBoundingClientRect();
      if (r.bottom > cTop + 1 && r.top < cBottom) {
        return { text: item.textContent ?? "", offset: r.top - cTop };
      }
    }
    return null;
  });
}

/** 指定文本条目的相对偏移（不在 DOM 时返回 null）。 */
function offsetOfText(feed: Locator, text: string): Promise<number | null> {
  return feed.evaluate((el, target) => {
    const cTop = el.getBoundingClientRect().top;
    for (const item of Array.from(el.querySelectorAll<HTMLElement>("[data-index]"))) {
      if ((item.textContent ?? "") === target) {
        return item.getBoundingClientRect().top - cTop;
      }
    }
    return null;
  }, text);
}

async function gotoDanmaku(page: Page, account: { username: string; password: string }) {
  await loginViaUi(page, account, BASE);
  await page.goto(`${BASE}/backdoor/danmaku`);
  await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();
}

test.describe("backdoor danmaku 弹幕看板", () => {
  test("danmaku-nav-columns: 侧边导航进入弹幕看板，默认三栏渲染历史事件并可收到实时事件", async ({
    page,
  }) => {
    const events = [
      danmakuEvent("dm:1", "第一条历史弹幕"),
      danmakuEvent("dm:guard", "舰长发的弹幕", 3),
      scEvent("sc:1", "第一条醒目留言"),
      giftEvent("gift:1", "小花花"),
      guardEvent("guard:1"),
    ];
    const stub = await stubLiveEvents(page, events);
    const accounts = getAccounts();

    await loginViaUi(page, accounts.admin, BASE);
    await page
      .getByRole("navigation", { name: "后台导航" })
      .getByRole("link", { name: "弹幕看板" })
      .click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku$/);
    await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();

    // 默认三栏：礼物 | SC+上船 | 弹幕
    await expect(page.getByRole("heading", { name: "礼物", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "SC + 上船", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "弹幕", exact: true })).toBeVisible();

    // 历史事件按栏渲染
    await expect(page.locator('[data-event-id="dm:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="sc:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="gift:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="guard:1"]')).toBeVisible();

    // 船员（guardLevel=3）的弹幕附带「舰长」标识
    await expect(page.locator('[data-event-id="dm:guard"]').getByText("舰长")).toBeVisible();
    await expect(page.locator('[data-event-id="dm:1"]').getByText(/舰长|提督|总督/)).toHaveCount(0);

    // SSE 实时事件 prepend 进对应栏
    await stub.push(danmakuEvent("dm:live", "实时弹幕到达"));
    await expect(page.locator('[data-event-id="dm:live"]')).toBeVisible();
    await stub.push(scEvent("sc:live", "实时醒目留言"));
    await expect(page.locator('[data-event-id="sc:live"]')).toBeVisible();
  });

  test("danmaku-scroll-anchor: 滚动中注入新事件位置不跳，可回到顶部看到新事件", async ({
    page,
  }) => {
    const events = Array.from({ length: 30 }, (_, i) =>
      danmakuEvent(`dm:${i + 1}`, `历史弹幕 ${i + 1}`),
    );
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    const feed = page.locator(".overflow-y-auto").filter({ has: page.locator('[data-event-id="dm:1"]') });
    await expect(page.locator('[data-event-id="dm:1"]')).toBeVisible();

    // 滚动离开顶部 → 出现「回到顶部」
    await feed.evaluate((el) => {
      el.scrollTop = 600;
      el.dispatchEvent(new Event("scroll"));
    });
    const backToTop = page.getByRole("button", { name: "回到顶部" });
    await expect(backToTop).toBeVisible();

    const before = await topVisibleItem(feed);
    expect(before, "滚动后应有视口顶部条目").not.toBeNull();

    // 滚动中注入新事件：prepend 导致 scrollHeight 增长，锚定补偿后原条目视口位置不跳。
    // 滚动态下新条目为 index 0，位于虚拟化渲染窗口之外（overscan=8、行高约 65px），
    // 其 DOM 存在性依赖像素级行高，故不在此断言；存在性由下方回到顶部后的 toBeVisible 覆盖。
    await stub.push(danmakuEvent("dm:live-anchor", "滚动中插入的实时弹幕"));
    await expect.poll(() => feed.evaluate((el) => el.scrollTop)).toBeGreaterThan(600);
    await expect
      .poll(async () => {
        const after = await offsetOfText(feed, before!.text);
        return after === null ? Number.NaN : Math.abs(after - before!.offset);
      })
      .toBeLessThanOrEqual(2);

    // 回到顶部：新事件在栏顶可见
    await backToTop.click();
    await expect.poll(() => feed.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(page.locator('[data-event-id="dm:live-anchor"]')).toBeVisible();
    await expect(backToTop).toHaveCount(0);
  });

  test("danmaku-retry: 历史检索失败显示错误提示，重试后恢复", async ({ page }) => {
    const events = [danmakuEvent("dm:500", "重试后出现的历史弹幕")];
    const stub = await stubLiveEvents(page, events);
    stub.setRangeDown(["danmaku"]);
    await gotoDanmaku(page, getAccounts().admin);

    // 弹幕栏进入错误态：错误提示 + 重试按钮，不落入「暂无事件」
    await expect(page.getByText("检索失败")).toBeVisible();
    const retry = page.getByRole("button", { name: "重试" });
    await expect(retry).toBeVisible();

    // 恢复上游并重试：弹幕栏重新检索成功，错误态消除
    stub.setRangeDown(null);
    await retry.click();
    await expect(page.locator('[data-event-id="dm:500"]')).toBeVisible();
    await expect(page.getByText("检索失败")).toHaveCount(0);
  });

  test("danmaku-toggle-read: 双击 SC 置灰且刷新后保持，再次双击取消已读", async ({ page }) => {
    const events = [scEvent("sc:100", "双击我标记已读"), scEvent("sc:101", "保持未读的参照")];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    const target = page.locator('[data-event-id="sc:100"]');
    const other = page.locator('[data-event-id="sc:101"]');
    await expect(target).toBeVisible();
    await expect(target).not.toHaveClass(/opacity-60/);

    // 双击置灰（双击落在留言文本上，事件冒泡到条目容器，避免点到 Sender 链接）
    await target.getByText("双击我标记已读").dblclick();
    await expect(target).toHaveClass(/opacity-60/);
    await expect.poll(() => stub.writes.filter((u) => u.endsWith("/read")).length).toBe(1);

    // 刷新后保持（page.route mock 在测试进程内维护已读状态）
    await page.reload();
    await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();
    await expect(page.locator('[data-event-id="sc:100"]')).toHaveClass(/opacity-60/);
    await expect(page.locator('[data-event-id="sc:101"]')).not.toHaveClass(/opacity-60/);

    // 再次双击取消已读，刷新后同样保持
    await page.locator('[data-event-id="sc:100"]').getByText("双击我标记已读").dblclick();
    await expect(page.locator('[data-event-id="sc:100"]')).not.toHaveClass(/opacity-60/);
    await expect.poll(() => stub.writes.filter((u) => u.endsWith("/unread")).length).toBe(1);
    await page.reload();
    await expect(page.locator('[data-event-id="sc:100"]')).not.toHaveClass(/opacity-60/);

    // 参照条全程未读
    await expect(other).not.toHaveClass(/opacity-60/);
  });

  test("danmaku-read-all: 「标记全部已读」二次确认后整体置灰且刷新后保持", async ({ page }) => {
    const events = [scEvent("sc:200", "待全部已读甲"), scEvent("sc:201", "待全部已读乙")];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    await expect(page.locator('[data-event-id="sc:200"]')).toBeVisible();

    // 首次点击仅进入二次确认态：不发写请求、条目不置灰
    await page.getByRole("button", { name: "SC 全部已读" }).click();
    const confirm = page.getByRole("button", { name: "确认全部已读？" });
    await expect(confirm).toBeVisible();
    expect(stub.writes.filter((u) => u.endsWith("/read-all"))).toHaveLength(0);
    await expect(page.locator('[data-event-id="sc:200"]')).not.toHaveClass(/opacity-60/);

    // 二次确认 → 整栏置灰
    await confirm.click();
    await expect.poll(() => stub.writes.filter((u) => u.endsWith("/read-all")).length).toBe(1);
    await expect(page.locator('[data-event-id="sc:200"]')).toHaveClass(/opacity-60/);
    await expect(page.locator('[data-event-id="sc:201"]')).toHaveClass(/opacity-60/);

    // 刷新后水位线效果保持（mock 状态跨 reload）
    await page.reload();
    await expect(page.locator('[data-event-id="sc:200"]')).toHaveClass(/opacity-60/);
    await expect(page.locator('[data-event-id="sc:201"]')).toHaveClass(/opacity-60/);
  });

  test("danmaku-member-readonly: member 账号不见已读交互（无双击置灰、无全部已读按钮）", async ({
    page,
  }) => {
    const events = [scEvent("sc:300", "member 只读醒目留言"), guardEvent("guard:300")];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().member);

    const sc = page.locator('[data-event-id="sc:300"]');
    await expect(sc).toBeVisible();

    // 无「标记全部已读」入口
    await expect(page.getByRole("button", { name: "SC 全部已读" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "上船 全部已读" })).toHaveCount(0);

    // 无双击已读交互：无提示 title，双击不产生写请求、不置灰
    await expect(sc).not.toHaveAttribute("title", "双击切换已读");
    await sc.getByText("member 只读醒目留言").dblclick();
    await page.waitForTimeout(500);
    expect(stub.writes).toHaveLength(0);
    await expect(sc).not.toHaveClass(/opacity-60/);
  });

  test("danmaku-column-config: 混排/分栏切换后刷新保留（localStorage 持久化）", async ({
    page,
  }) => {
    const events = [scEvent("sc:400", "栏位配置页SC"), guardEvent("guard:400")];
    await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    // 默认 SC+上船 栏为混排：SC 与上船同栏渲染
    await expect(page.locator('[data-event-id="sc:400"]')).toBeVisible();
    await expect(page.locator('[data-event-id="guard:400"]')).toBeVisible();

    // 打开 SC+上船 栏配置，默认「混排」选中
    await page.getByRole("button", { name: "配置「SC + 上船」栏" }).click();
    await expect(page.getByRole("radio", { name: "混排" })).toBeChecked();

    // 切到「分栏」：SC / 上船 上下分栏（出现两小节标签）
    await page.getByRole("radio", { name: "分栏" }).check();
    await expect(page.locator(".text-xs.font-medium.text-ink-dim")).toHaveText(["SC", "上船"]);

    const stored = await page.evaluate(() => localStorage.getItem("danmaku-backdoor.columns"));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "sc_guard", types: ["super_chat", "guard_buy"], mode: "split" }),
      ]),
    );

    // 刷新后仍分栏
    await page.reload();
    await expect(page.locator(".text-xs.font-medium.text-ink-dim")).toHaveText(["SC", "上船"]);
  });
});
