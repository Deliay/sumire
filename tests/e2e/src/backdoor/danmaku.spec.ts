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
  /** 令搜索接口返回 502（模拟上游不可用）；传 null 恢复 200。 */
  setSearchDown: (down: boolean) => void;
  /** 设置在线人数（null 表示请求失败返回空 items）。 */
  setOnlineCount: (count: number | null) => void;
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
  let searchDown = false;
  let onlineCount: number | null = null;

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
      if (types.includes("online_rank_count")) {
        if (onlineCount === null) {
          return fulfillJson(200, { total: 0, page: 1, pageSize: 50, items: [] });
        }
        return fulfillJson(200, {
          total: 1,
          page: 1,
          pageSize: 50,
          items: [
            {
              roomId: 12345,
              type: "online_rank_count",
              occurredAt: new Date().toISOString(),
              liveSessionId: "session-1",
              payload: { online_count: onlineCount },
            },
          ],
        });
      }
      if (rangeDownTypes && types.some((t) => (rangeDownTypes as string[]).includes(t))) {
        return fulfillJson(502, { error: "上游事件服务不可用" });
      }
      const items = events
        .filter((e) => types.length === 0 || types.includes(e.type))
        .map((e) => ({ ...e, read: readState.get(e.eventId) ?? e.read }));
      return fulfillJson(200, { total: items.length, page: 1, pageSize: 50, items });
    }
    if (req.method() === "GET" && url.pathname === "/api/live-events/search") {
      const criteria = url.searchParams.get("stringCriteria") ?? "";
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
      if (searchDown) {
        return fulfillJson(502, { error: "上游事件服务不可用" });
      }
      const matched = events
        .filter((e) => {
          if (!criteria) return false;
          const content = e.content ?? "";
          return content.includes(criteria);
        })
        .map((e) => ({ ...e, read: readState.get(e.eventId) ?? e.read }));
      const items = matched.slice((page - 1) * pageSize, page * pageSize);
      return fulfillJson(200, { total: matched.length, page, pageSize, items });
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
    setSearchDown: (down) => {
      searchDown = down;
    },
    setOnlineCount: (count) => {
      onlineCount = count;
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

    // 默认三栏：礼物 | 上船+SC | 弹幕
    await expect(page.getByRole("heading", { name: "礼物", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "上船 + SC", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "弹幕", exact: true })).toBeVisible();

    // 历史事件按栏渲染
    await expect(page.locator('[data-event-id="dm:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="sc:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="gift:1"]')).toBeVisible();
    await expect(page.locator('[data-event-id="guard:1"]')).toBeVisible();

    // 船员（guardLevel=3）的弹幕附带「舰长」标识（exact：避免误匹配弹幕内容文本）
    await expect(page.locator('[data-event-id="dm:guard"]').getByText("舰长", { exact: true })).toBeVisible();
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

    // 信息流容器按栏位标题定位（不依赖具体条目：滚动后虚拟化会卸载视口外条目）
    const feed = page
      .locator("section", { has: page.getByRole("heading", { name: "弹幕", exact: true }) })
      .locator(".overflow-y-auto");
    await expect(page.locator('[data-event-id="dm:1"]')).toBeVisible();

    // 滚动离开顶部 → 出现「回到顶部」
    await feed.evaluate((el) => {
      el.scrollTop = 600;
      el.dispatchEvent(new Event("scroll"));
    });
    const backToTop = page.getByRole("button", { name: "回到顶部" });
    await expect(backToTop).toBeVisible();

    // 滚动会触发新入行实测回填与平移过渡，等位置稳定后再取锚点基线（避免拿到过渡中的中间值）
    await expect
      .poll(async () => {
        const a = await topVisibleItem(feed);
        await page.waitForTimeout(120);
        const b = await topVisibleItem(feed);
        return a !== null && b !== null && a.text === b.text && Math.abs(a.offset - b.offset) < 0.5;
      })
      .toBe(true);
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

    // 双击置灰（F3 起留言文本双击被隔离以便选中复制，直接在条目容器上派发 dblclick）
    await target.dispatchEvent("dblclick");
    await expect(target).toHaveClass(/opacity-60/);
    await expect.poll(() => stub.writes.filter((u) => u.endsWith("/read")).length).toBe(1);

    // 刷新后保持（page.route mock 在测试进程内维护已读状态）
    await page.reload();
    await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();
    await expect(page.locator('[data-event-id="sc:100"]')).toHaveClass(/opacity-60/);
    await expect(page.locator('[data-event-id="sc:101"]')).not.toHaveClass(/opacity-60/);

    // 再次双击取消已读，刷新后同样保持
    await page.locator('[data-event-id="sc:100"]').dispatchEvent("dblclick");
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

  test("danmaku-enter-animation: 实时事件入场挂载 animate-danmaku-enter 且动画真实运行", async ({
    page,
  }) => {
    const events = [danmakuEvent("dm:1", "历史弹幕")];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);
    await expect(page.locator('[data-event-id="dm:1"]')).toBeVisible();

    // 历史首屏条目不触发入场动效
    await expect(page.locator(".animate-danmaku-enter")).toHaveCount(0);

    // 四类实时事件（契约同构 mock 体）逐一推送，均应有入场动效
    const liveEvents: MockLiveEvent[] = [
      danmakuEvent("dm:anim", "实时弹幕动效"),
      scEvent("sc:anim", "实时SC动效"),
      giftEvent("gift:anim", "节奏风暴"),
      guardEvent("guard:anim"),
    ];
    for (const event of liveEvents) {
      await stub.push(event);
      const wrapper = page
        .locator(".animate-danmaku-enter")
        .filter({ has: page.locator(`[data-event-id="${event.eventId}"]`) });
      await expect(wrapper).toHaveCount(1);
      // 真实浏览器中断言 CSS 动画已应用于该节点（danmaku-enter keyframes）
      const animationNames = await wrapper.evaluate((el) =>
        el.getAnimations().map((a) => (a as CSSAnimation).animationName),
      );
      expect(animationNames).toContain("danmaku-enter");
    }

    // freshIds 300ms 批量清除：动效类随之移除，条目保留
    await expect(page.locator(".animate-danmaku-enter")).toHaveCount(0);
    await expect(page.locator('[data-event-id="dm:anim"]')).toBeVisible();
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
    await sc.dispatchEvent("dblclick");
    await page.waitForTimeout(500);
    expect(stub.writes).toHaveLength(0);
    await expect(sc).not.toHaveClass(/opacity-60/);
  });

  test("danmaku-column-config: 分栏/混排切换后刷新保留（localStorage 持久化）", async ({
    page,
  }) => {
    const events = [scEvent("sc:400", "栏位配置页SC"), guardEvent("guard:400")];
    await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    // 默认 上船+SC 栏为分栏：上船 / SC 上下分两小节（标签按 types 顺序）
    await expect(page.locator('[data-event-id="sc:400"]')).toBeVisible();
    await expect(page.locator('[data-event-id="guard:400"]')).toBeVisible();
    await expect(page.locator(".text-xs.font-medium.text-ink-dim")).toHaveText(["上船", "SC"]);

    // 打开 上船+SC 栏配置，默认「分栏」选中
    await page.getByRole("button", { name: "配置「上船 + SC」栏" }).click();
    await expect(page.getByRole("radio", { name: "分栏" })).toBeChecked();

    // 切到「混排」：小节合并，标签消失，两事件仍同栏渲染
    await page.getByRole("radio", { name: "混排" }).check();
    await expect(page.locator(".text-xs.font-medium.text-ink-dim")).toHaveCount(0);
    await expect(page.locator('[data-event-id="sc:400"]')).toBeVisible();
    await expect(page.locator('[data-event-id="guard:400"]')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("danmaku-backdoor.columns"));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "guard_sc", types: ["guard_buy", "super_chat"], mode: "mixed" }),
      ]),
    );

    // 刷新后仍混排
    await page.reload();
    await expect(page.locator('[data-event-id="sc:400"]')).toBeVisible();
    await expect(page.locator(".text-xs.font-medium.text-ink-dim")).toHaveCount(0);
  });

  test("danmaku-search-basic: 从看板进入检索页，输入关键词显示结果卡片", async ({ page }) => {
    const events = [
      danmakuEvent("dm:s1", "测试弹幕关键词"),
      danmakuEvent("dm:s2", "另一条弹幕"),
      scEvent("sc:s1", "SC留言关键词"),
    ];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    // 点击导航栏「弹幕检索」链接进入检索页
    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku\/search/);
    await expect(page.getByRole("heading", { name: "弹幕检索" })).toBeVisible();

    // 输入关键词搜索
    const input = page.getByLabel("弹幕检索关键词");
    await input.fill("关键词");

    // 等待搜索结果
    await expect(page.getByText("共 2 条")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("mark")).toHaveCount(2);
    await expect(page.getByText("测试弹幕关键词")).toBeVisible();
    await expect(page.getByText("SC留言关键词")).toBeVisible();
  });

  test("danmaku-search-highlight: 搜索结果中关键词被高亮显示", async ({ page }) => {
    const events = [danmakuEvent("dm:h1", "今天天气真好")];
    await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    await page.getByLabel("弹幕检索关键词").fill("天气");
    await expect(page.getByText("共 1 条")).toBeVisible({ timeout: 5000 });

    const mark = page.locator("mark").first();
    await expect(mark).toHaveText("天气");
  });

  test("danmaku-search-empty: 无匹配结果时显示「无匹配弹幕」", async ({ page }) => {
    const events = [danmakuEvent("dm:e1", "弹幕内容")];
    await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    await page.getByLabel("弹幕检索关键词").fill("不存在的关键词");
    await expect(page.getByText("无匹配弹幕")).toBeVisible({ timeout: 5000 });
  });

  test("danmaku-search-error: 搜索服务不可用时显示错误提示", async ({ page }) => {
    const events = [danmakuEvent("dm:err1", "弹幕")];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    stub.setSearchDown(true);
    await page.getByLabel("弹幕检索关键词").fill("弹幕");
    await expect(page.getByText("搜索服务不可用")).toBeVisible({ timeout: 5000 });

    // 重试恢复
    stub.setSearchDown(false);
    await page.getByRole("button", { name: "重试" }).click();
    await expect(page.getByText("共 1 条")).toBeVisible({ timeout: 5000 });
  });

  test("danmaku-search-back: 点击「返回看板」回到弹幕看板页", async ({ page }) => {
    await stubLiveEvents(page, []);
    await gotoDanmaku(page, getAccounts().admin);

    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku\/search/);

    await page.getByRole("link", { name: "返回看板" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku$/);
    await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();
  });

  test("danmaku-search-v2-nav-entry-active-state: 导航入口与选中态", async ({ page }) => {
    await stubLiveEvents(page, []);
    const accounts = getAccounts();
    await loginViaUi(page, accounts.admin, BASE);

    // 登录后左侧导航可见「弹幕检索」且位于「弹幕看板」之后
    const nav = page.getByRole("navigation", { name: "后台导航" });
    const danmakuBoardLink = nav.getByRole("link", { name: "弹幕看板" });
    const danmakuSearchLink = nav.getByRole("link", { name: "弹幕检索" });
    await expect(danmakuBoardLink).toBeVisible();
    await expect(danmakuSearchLink).toBeVisible();

    // 验证顺序：弹幕看板在弹幕检索之前
    const boardBox = await danmakuBoardLink.boundingBox();
    const searchBox = await danmakuSearchLink.boundingBox();
    expect(boardBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(boardBox!.y).toBeLessThan(searchBox!.y);

    // 点击进入弹幕检索页
    await danmakuSearchLink.click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku\/search/);
    await expect(page.getByRole("heading", { name: "弹幕检索" })).toBeVisible();

    // 导航仅「弹幕检索」高亮（含 border-primary 类）
    await expect(danmakuSearchLink).toHaveClass(/border-primary/);
    await expect(danmakuBoardLink).not.toHaveClass(/border-primary/);

    // 返回看板页
    await page.getByRole("link", { name: "返回看板" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku$/);
    await expect(page.getByRole("heading", { name: "弹幕看板" })).toBeVisible();

    // 导航仅「弹幕看板」高亮
    await expect(danmakuBoardLink).toHaveClass(/border-primary/);
    await expect(danmakuSearchLink).not.toHaveClass(/border-primary/);
  });

  test("danmaku-search-v2-mixed-results: 混合类型结果渲染", async ({ page }) => {
    const events = [
      danmakuEvent("dm:mix1", "普通弹幕内容"),
      scEvent("sc:mix1", "SC留言内容"),
      giftEvent("gift:mix1", "小花花"),
      guardEvent("guard:mix1"),
    ];
    const stub = await stubLiveEvents(page, events);
    await gotoDanmaku(page, getAccounts().admin);

    // 进入检索页
    await page.getByRole("navigation", { name: "后台导航" }).getByRole("link", { name: "弹幕检索" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku\/search/);

    // 输入关键词搜索：命中弹幕与SC（gift/guard 无 content 不命中）
    const input = page.getByLabel("弹幕检索关键词");
    await input.fill("内容");

    // 等待搜索结果
    await expect(page.getByText("共 2 条")).toBeVisible({ timeout: 5000 });

    // 断言SC呈现金额与气泡样式
    const scCard = page.locator('[data-event-id="sc:mix1"]');
    await expect(scCard).toBeVisible();
    await expect(scCard.getByText("¥100")).toBeVisible();
    await expect(scCard.locator(".rounded-md")).toBeVisible();

    // 断言弹幕保持 <mark> 高亮卡片（弹幕和SC结果均含高亮）
    await expect(page.locator("mark").filter({ hasText: "内容" })).toHaveCount(2);

    // 返回看板页验证礼物与上船渲染
    await page.getByRole("link", { name: "返回看板" }).click();
    await expect(page).toHaveURL(/\/backdoor\/danmaku$/);

    // 断言礼物呈现礼物名
    const giftCard = page.locator('[data-event-id="gift:mix1"]');
    await expect(giftCard).toBeVisible();
    await expect(giftCard.getByText("小花花")).toBeVisible();

    // 断言上船呈现船型徽章
    const guardCard = page.locator('[data-event-id="guard:mix1"]');
    await expect(guardCard).toBeVisible();
    await expect(guardCard.getByText("舰长")).toBeVisible();
  });

  test("online-count-show: 在线人数正常显示", async ({ page }) => {
    const stub = await stubLiveEvents(page, []);
    stub.setOnlineCount(1521);
    await gotoDanmaku(page, getAccounts().admin);

    await expect(page.getByText("当前直播间在线 1521 人")).toBeVisible();
  });

  test("online-count-fail-hide: 在线人数获取失败时不显示", async ({ page }) => {
    const stub = await stubLiveEvents(page, []);
    stub.setOnlineCount(null);
    await gotoDanmaku(page, getAccounts().admin);

    await expect(page.getByText(/在线.*人/)).toHaveCount(0);
  });
});
