// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import type { Role } from "@/features/backdoor/api";
import { COLUMNS_STORAGE_KEY } from "@/features/danmaku/columns";
import { MERGE_ENABLED_STORAGE_KEY } from "@/features/danmaku/mergeEnabled";

const listLiveEvents = vi.fn();
const markLiveEventRead = vi.fn();
const markLiveEventUnread = vi.fn();
const markAllLiveEventsRead = vi.fn();

vi.mock("@/features/danmaku/api", () => ({
  listLiveEvents: (...args: unknown[]) => listLiveEvents(...args),
  markLiveEventRead: (...args: unknown[]) => markLiveEventRead(...args),
  markLiveEventUnread: (...args: unknown[]) => markLiveEventUnread(...args),
  markAllLiveEventsRead: (...args: unknown[]) => markAllLiveEventsRead(...args),
}));

let currentRole: Role = "admin";
vi.mock("@/features/backdoor/session", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      me: { ok: true, username: "u", role: currentRole, mustChangePassword: false },
    },
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

// SSE 流 mock：捕获事件回调供测试手动触发（避免依赖 EventSource）
let streamHandler: ((event: LiveEvent) => void) | null = null;
vi.mock("@/features/danmaku/useLiveEventStream", () => ({
  useLiveEventStream: (_types: unknown, onEvent: (event: LiveEvent) => void) => {
    streamHandler = onEvent;
    return "open";
  },
}));

import DanmakuDashboard, { type DanmakuDashboardHandle } from "@/features/danmaku/components/DanmakuDashboard";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null };

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return { occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, ...partial };
}

const SC_EVENT = makeEvent({ eventId: "sc:1", type: "super_chat", content: "醒目留言一", price: 30 });
const DM_EVENT = makeEvent({ eventId: "dm:1", type: "danmaku", content: "弹幕一" });
const GIFT_EVENT = makeEvent({ eventId: "gift:1", type: "gift", price: 5, gift: { name: "辣条", count: 1 } });
const GUARD_EVENT = makeEvent({
  eventId: "guard:1",
  type: "guard_buy",
  price: 138,
  guard: { level: 3, name: "舰长", count: 1 },
});

function mockListLiveEvents() {
  listLiveEvents.mockImplementation(async (types: string[]) => {
    const items = [SC_EVENT, DM_EVENT, GIFT_EVENT, GUARD_EVENT].filter((e) =>
      types.includes(e.type),
    );
    return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
  });
}

/** 按查询字符串返回对应 matches 的 matchMedia 桩（供 useMediaQuery 视口档位测试）。 */
function stubMatchMedia(matchesMap: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matchesMap[query] ?? false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("DanmakuDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentRole = "admin";
    // 默认桌面视口（wide：>=1024）
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    // jsdom 无布局：virtualizer 经 offsetWidth/offsetHeight 实测视口，stub 固定尺寸
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    // scrollHeight 无布局为 0 → 会误判「已达底部」：stub 较大值，滚动时才进入底部余量
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
    mockListLiveEvents();
    markLiveEventRead.mockResolvedValue({ status: 200, data: { ok: true } });
    markLiveEventUnread.mockResolvedValue({ status: 200, data: { ok: true } });
    markAllLiveEventsRead.mockResolvedValue({ status: 200, data: { ok: true, marked: 1 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    streamHandler = null;
  });

  it("历史首屏检索结果不带入场动画类", async () => {
    const { container } = render(<DanmakuDashboard />);
    await screen.findByText("弹幕一");
    expect(container.querySelector(".animate-danmaku-enter")).toBeNull();
  });

  it("SSE 新事件插入时对应行带入场动画类，300ms 后批量清除", async () => {
    const { container } = render(<DanmakuDashboard />);
    await screen.findByText("弹幕一");
    vi.useFakeTimers();
    act(() => {
      streamHandler?.(makeEvent({ eventId: "dm:fresh", type: "danmaku", content: "实时弹幕" }));
    });
    const item = container.querySelector('[data-event-id="dm:fresh"]') as HTMLElement;
    expect(item).not.toBeNull();
    expect(item.parentElement?.className).toContain("animate-danmaku-enter");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(item.parentElement?.className ?? "").not.toContain("animate-danmaku-enter");
    vi.useRealTimers();
  });

  it("SSE 去重跳过（eventId 已在列表中）不标记入场动画", async () => {
    const { container } = render(<DanmakuDashboard />);
    await screen.findByText("弹幕一");
    act(() => {
      streamHandler?.(makeEvent({ eventId: "dm:1", type: "danmaku", content: "弹幕一" }));
    });
    expect(container.querySelector(".animate-danmaku-enter")).toBeNull();
  });

  it("默认三栏渲染并按类型分栏加载历史事件", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    expect(screen.getByText(/辣条/)).toBeTruthy();
    // mixed 栏走合并请求：["gift","guard_buy"] 一次；SC / 弹幕 各自独立
    const calledTypes = listLiveEvents.mock.calls.map((c) => c[0]);
    expect(calledTypes).toContainEqual(["gift", "guard_buy"]);
    expect(calledTypes).toContainEqual(["super_chat"]);
    expect(calledTypes).toContainEqual(["danmaku"]);
  });

  it("默认 wide 渲染 礼物+上船(混排) | SC | 弹幕 三栏标题", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByRole("heading", { name: "礼物 + 上船" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "SC" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "弹幕" })).toBeTruthy();
  });

  it("上船+礼物混排栏：guard_buy 与 gift 按时间混排", async () => {
    const { container } = render(<DanmakuDashboard />);
    await screen.findByText("醒目留言一");
    // 默认 gift_guard 栏为 mixed 模式：礼物与上船混排，无分栏标签
    expect(container.querySelectorAll(".text-xs.font-medium.text-ink-dim")).toHaveLength(0);
  });

  it("配置面板切换混排/分栏：渲染小节并持久化 mode", async () => {
    const { container } = render(<DanmakuDashboard />);
    await screen.findByText("醒目留言一");
    fireEvent.click(screen.getByRole("button", { name: /配置「礼物 \+ 上船」栏/ }));
    fireEvent.click(screen.getByRole("radio", { name: "分栏" }));

    expect(screen.getByRole("radio", { name: "分栏" })).toBeTruthy();
    const labels = [...container.querySelectorAll(".text-xs.font-medium.text-ink-dim")].map(
      (n) => n.textContent,
    );
    expect(labels).toEqual(["礼物", "上船"]);
  });

  it("admin 双击 SC：乐观置灰并调用 read 接口", async () => {
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    expect(row.className).not.toContain("opacity-60");
    fireEvent.doubleClick(row);
    // 乐观更新：立即置灰
    expect(row.className).toContain("opacity-60");
    expect(markLiveEventRead).toHaveBeenCalledWith("sc:1");
    await waitFor(() => expect(markLiveEventRead).toHaveBeenCalledTimes(1));
  });

  it("双击已读 SC：调用 unread 接口去除置灰", async () => {
    listLiveEvents.mockImplementation(async (types: string[]) => {
      const items = [DM_EVENT, GIFT_EVENT, { ...SC_EVENT, read: true }].filter((e) =>
        types.includes(e.type),
      );
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    expect(row.className).toContain("opacity-60");
    fireEvent.doubleClick(row);
    expect(row.className).not.toContain("opacity-60");
    expect(markLiveEventUnread).toHaveBeenCalledWith("sc:1");
  });

  it("已读切换失败回滚并提示", async () => {
    markLiveEventRead.mockResolvedValue({ status: 500, data: { error: "x" } });
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    fireEvent.doubleClick(row);
    expect(row.className).toContain("opacity-60"); // 乐观
    await waitFor(() => expect(row.className).not.toContain("opacity-60")); // 回滚
    expect(await screen.findByText(/操作失败/)).toBeTruthy();
  });

  it("member 双击不触发已读交互", async () => {
    currentRole = "member";
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    fireEvent.doubleClick(row);
    expect(markLiveEventRead).not.toHaveBeenCalled();
    expect(markLiveEventUnread).not.toHaveBeenCalled();
  });

  it("经 ref 调用 readAll(\"super_chat\") 后该类型事件整体置灰", async () => {
    const ref = { current: null as DanmakuDashboardHandle | null };
    render(<DanmakuDashboard ref={(r) => { ref.current = r; }} />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    await act(async () => {
      await ref.current?.readAll("super_chat");
    });
    await waitFor(() => expect(markAllLiveEventsRead).toHaveBeenCalledWith("super_chat"));
    await waitFor(() => expect(row.className).toContain("opacity-60"));
  });

  it("历史检索失败（非 200）时该栏显示错误态与重试按钮，其它栏不受影响", async () => {
    listLiveEvents.mockImplementation(async (types: string[]) => {
      if (types.length === 1 && types[0] === "danmaku") {
        return { status: 502, data: { error: "上游事件服务不可用" } };
      }
      const items = [SC_EVENT, DM_EVENT, GIFT_EVENT].filter((e) => types.includes(e.type));
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
    render(<DanmakuDashboard />);

    // 弹幕栏进入错误态：显示错误提示 + 重试按钮，不落入「暂无事件」
    expect(await screen.findByText("检索失败")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
    // 其余栏正常渲染（SC 栏独立不受影响）
    expect(screen.getByText("醒目留言一")).toBeTruthy();
  });

  it("历史检索失败后点击重试，重新检索并恢复该栏", async () => {
    listLiveEvents.mockImplementation(async (types: string[]) => {
      if (types.length === 1 && types[0] === "danmaku") {
        return { status: 502, data: { error: "上游事件服务不可用" } };
      }
      return { status: 200, data: { total: 0, page: 1, pageSize: 50, items: [] } };
    });
    render(<DanmakuDashboard />);
    const retry = await screen.findByRole("button", { name: "重试" });

    // 重试成功（弹幕栏回落默认成功实现）
    listLiveEvents.mockImplementation(async (types: string[]) => {
      const items = [SC_EVENT, DM_EVENT, GIFT_EVENT].filter((e) => types.includes(e.type));
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
    fireEvent.click(retry);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("检索失败")).toBeNull());
  });

  it("历史检索网络异常（reject）同样进入错误态并可重试", async () => {
    listLiveEvents.mockImplementation(async (types: string[]) => {
      if (types.length === 1 && types[0] === "danmaku") {
        throw new Error("network down");
      }
      return { status: 200, data: { total: 0, page: 1, pageSize: 50, items: [] } };
    });
    render(<DanmakuDashboard />);
    expect(await screen.findByText("检索失败")).toBeTruthy();
    listLiveEvents.mockImplementation(async (types: string[]) => {
      const items = [SC_EVENT, DM_EVENT, GIFT_EVENT].filter((e) => types.includes(e.type));
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("弹幕一")).toBeTruthy();
  });

  it("滚动接近尾部触发加载下一页历史（分页 append 去重）", async () => {
    // 分页 mock：弹幕栏第一页 20 条 total=21，第二页 1 条 total=21
    const page1 = Array.from({ length: 20 }, (_, i) =>
      makeEvent({ eventId: `dm:p1-${i}`, type: "danmaku", content: `弹幕一页${i}` }),
    );
    listLiveEvents.mockImplementation(async (types: string[], page = 1) => {
      if (types.length === 1 && types[0] === "danmaku") {
        const page2Event = makeEvent({ eventId: "dm:2", type: "danmaku", content: "弹幕二（下一页）" });
        return {
          status: 200,
          data: {
            total: 21,
            page,
            pageSize: 20,
            items: page === 1 ? page1 : [page2Event],
          },
        };
      }
      return { status: 200, data: { total: 0, page, pageSize: 50, items: [] } };
    });
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一页0")).toBeTruthy();

    // 首屏第一页足够长、未触及尾部：未请求第二页
    expect(listLiveEvents.mock.calls.some((c) => c[1] === 2)).toBe(false);

    // 滚动至弹幕信息流底部（scrollHeight 2000 - clientHeight 600 - 余量）→ 触发加载第二页
    const feed = (screen.getByText("弹幕一页0").closest(".overflow-y-auto") ??
      document.querySelector('[aria-label="弹幕信息流"]')) as HTMLElement;
    expect(feed).not.toBeNull();
    await act(async () => {
      feed.scrollTop = 1400;
      fireEvent.scroll(feed);
    });
    await waitFor(() =>
      expect(listLiveEvents.mock.calls.some((c) => c[1] === 2)).toBe(true),
    );
  });

  it("narrow(<640) 折叠为单栏全类型，配置面板全部勾选", async () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    render(<DanmakuDashboard />);

    // 单栏渲染全部四类事件
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    expect(screen.getByText(/辣条/)).toBeTruthy();

    // 打开配置面板：全部四类勾选
    fireEvent.click(screen.getByRole("button", { name: /配置「SC \+ 上船 \+ 礼物 \+ 弹幕」栏/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    for (const cb of checkboxes) expect((cb as HTMLInputElement).checked).toBe(true);
  });

  it("跨视口自适应不覆盖已存配置：桌面 3 栏在窄屏折叠为单栏", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    // 桌面未显式写入时 localStorage 为空，折叠为纯视图层
    expect(window.localStorage.getItem(COLUMNS_STORAGE_KEY)).toBeNull();

    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    // 重新渲染以触发新视口档位
    cleanup();
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    // 仍为纯视图层折叠：localStorage 未被写入
    expect(window.localStorage.getItem(COLUMNS_STORAGE_KEY)).toBeNull();
  });

  it("「弹幕合并」开关仅在勾选弹幕类型的栏工具区渲染（默认三栏仅弹幕栏），默认 aria-checked=false", async () => {
    render(<DanmakuDashboard />);
    await screen.findByText("弹幕一");
    // 默认三栏「礼物 | 上船+SC | 弹幕」：仅弹幕栏含 danmaku 类型，只渲染一个开关
    const switches = screen.getAllByRole("switch", { name: "弹幕合并" });
    expect(switches).toHaveLength(1);
    for (const sw of switches) expect(sw.getAttribute("aria-checked")).toBe("false");
  });

  it("点击「弹幕合并」开关切换 aria-checked 并全局生效", async () => {
    render(<DanmakuDashboard />);
    await screen.findByText("弹幕一");
    fireEvent.click(screen.getAllByRole("switch", { name: "弹幕合并" })[0]);
    for (const sw of screen.getAllByRole("switch", { name: "弹幕合并" })) {
      expect(sw.getAttribute("aria-checked")).toBe("true");
    }
  });

  /** 弹幕节返回两条同内容重复弹幕（折叠键相同）。 */
  function mockDuplicateDanmaku() {
    listLiveEvents.mockImplementation(async (types: string[]) => {
      const items = [
        makeEvent({ eventId: "dm:d1", type: "danmaku", content: "妈妈" }),
        makeEvent({ eventId: "dm:d2", type: "danmaku", content: "妈妈" }),
        SC_EVENT,
        GIFT_EVENT,
        GUARD_EVENT,
      ].filter((e) => types.includes(e.type));
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
  }

  it("默认合并关闭：重复弹幕逐条渲染，无「×N」计数", async () => {
    mockDuplicateDanmaku();
    render(<DanmakuDashboard />);
    await screen.findAllByText("妈妈");
    expect(screen.getAllByText("妈妈")).toHaveLength(2);
    expect(screen.queryByText(/×\d+/)).toBeNull();
  });

  it("开关切换即时折叠（不重新检索）且 localStorage 写入 true", async () => {
    mockDuplicateDanmaku();
    render(<DanmakuDashboard />);
    await screen.findAllByText("妈妈");
    const danmakuCallsBefore = listLiveEvents.mock.calls.filter((c) => c[0].includes("danmaku")).length;

    fireEvent.click(screen.getAllByRole("switch", { name: "弹幕合并" })[0]);

    // 即时折叠为单行 ×2，且不触发新的弹幕检索
    expect(screen.getByText("×2")).toBeTruthy();
    expect(window.localStorage.getItem(MERGE_ENABLED_STORAGE_KEY)).toBe("true");
    const danmakuCallsAfter = listLiveEvents.mock.calls.filter((c) => c[0].includes("danmaku")).length;
    expect(danmakuCallsAfter).toBe(danmakuCallsBefore);
  });

  it("localStorage 预置 true 时首屏即折叠重复弹幕", async () => {
    window.localStorage.setItem(MERGE_ENABLED_STORAGE_KEY, "true");
    mockDuplicateDanmaku();
    render(<DanmakuDashboard />);
    expect(await screen.findByText("×2")).toBeTruthy();
    expect(screen.getAllByRole("switch", { name: "弹幕合并" })[0].getAttribute("aria-checked")).toBe("true");
  });

  it("礼物筛选阈值变更后礼物节以新阈值重载", async () => {
    render(<DanmakuDashboard />);
    await screen.findByText("辣条");

    // 初始调用：礼物节携带 minPrice（第4参为 0，loadGiftMinPrice 返回 0）
    const giftCallsBefore = listLiveEvents.mock.calls.filter((c) => c[0].includes("gift"));
    expect(giftCallsBefore.length).toBeGreaterThan(0);
    expect(giftCallsBefore[giftCallsBefore.length - 1][3]).toBe(0);

    // 点击「礼物筛选」按钮打开弹层
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));

    // 输入新阈值并 blur 提交
    const input = screen.getByLabelText("最低礼物价值（元）");
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.blur(input);

    // 等待礼物节以新阈值重载
    await waitFor(() => {
      const giftCallsAfter = listLiveEvents.mock.calls.filter((c) => c[0].includes("gift"));
      const lastCall = giftCallsAfter[giftCallsAfter.length - 1];
      expect(lastCall[3]).toBe(10);
    });
  });

  describe("混排合并分页", () => {
    const GIFT_P1 = [
      makeEvent({ eventId: "gift:p1-1", type: "gift", price: 5, gift: { name: "辣条p1", count: 1 } }),
      makeEvent({ eventId: "gift:p1-2", type: "gift", price: 10, gift: { name: "花束", count: 1 } }),
    ];
    const GUARD_P1 = [
      makeEvent({ eventId: "guard:p1-1", type: "guard_buy", price: 138, guard: { level: 3, name: "舰长", count: 1 } }),
      makeEvent({ eventId: "guard:p1-2", type: "guard_buy", price: 138, guard: { level: 3, name: "舰长", count: 1 } }),
    ];
    const GIFT_P2 = [
      makeEvent({ eventId: "gift:p2-1", type: "gift", price: 20, gift: { name: "打call", count: 1 } }),
    ];
    const GUARD_P2 = [
      makeEvent({ eventId: "guard:p2-1", type: "guard_buy", price: 138, guard: { level: 3, name: "舰长", count: 1 } }),
    ];

    function mockMixedPaging() {
      // 首屏：mixed 栏走合并请求，SC/弹幕各自独立
      // 混排栏滚动加载：合并请求（loadMoreSectionMerged）
      listLiveEvents.mockImplementation(async (types: string[], page = 1) => {
        // 混排栏合并请求：["gift","guard_buy"]（首屏 page1 + 滚动 page2）
        if (types.length === 2 && types.includes("gift") && types.includes("guard_buy")) {
          const items = page === 1
            ? [...GIFT_P1, ...GUARD_P1]
            : [...GIFT_P2, ...GUARD_P2];
          return {
            status: 200,
            data: { total: 6, page, pageSize: 50, items },
          };
        }
        if (types.length === 1 && types[0] === "super_chat") {
          return { status: 200, data: { total: 1, page, pageSize: 50, items: [SC_EVENT] } };
        }
        if (types.length === 1 && types[0] === "danmaku") {
          return { status: 200, data: { total: 1, page, pageSize: 50, items: [DM_EVENT] } };
        }
        return { status: 200, data: { total: 0, page, pageSize: 50, items: [] } };
      });
    }

    it("混排栏滚动加载以 listLiveEvents([gift,guard_buy], page, size) 合并调用", async () => {
      mockMixedPaging();
      render(<DanmakuDashboard />);
      await screen.findByText(/辣条p1/);

      // 首屏：混排栏走合并请求（loadSectionMerged）
      const mergedCalls = listLiveEvents.mock.calls.filter(
        (c) => c[0].length === 2 && c[0].includes("gift") && c[0].includes("guard_buy"),
      );
      expect(mergedCalls).toHaveLength(1);
      expect(mergedCalls[0][0]).toEqual(["gift", "guard_buy"]);
      expect(mergedCalls[0][1]).toBe(1);

      // 混排 FeedSection 通过 data-testid 定位（混排栏 sections.length===1 无 aria-label）
      const mixedFeed = document.querySelector('[data-testid="gift_guard-merged-feed"]') as HTMLElement;
      expect(mixedFeed).not.toBeNull();

      // 滚动到底部触发 loadMoreSectionMerged
      await act(async () => {
        mixedFeed.scrollTop = 1400;
        fireEvent.scroll(mixedFeed);
      });
      await waitFor(() => {
        const scrollCalls = listLiveEvents.mock.calls.filter(
          (c) => c[0].length === 2 && c[0].includes("gift") && c[0].includes("guard_buy"),
        );
        // 首屏1次 + 滚动1次 = 2次
        expect(scrollCalls).toHaveLength(2);
        expect(scrollCalls[1][0]).toEqual(["gift", "guard_buy"]);
        expect(scrollCalls[1][1]).toBe(2);
      });
    });

    it("混排栏 hasMore 随数据耗尽变为 false", async () => {
      mockMixedPaging();
      render(<DanmakuDashboard />);
      await screen.findByText(/辣条p1/);

      // 混排 FeedSection 通过 data-testid 定位
      const mixedFeed = document.querySelector('[data-testid="gift_guard-merged-feed"]') as HTMLElement;
      expect(mixedFeed).not.toBeNull();

      // 首屏已加载 4 条（gift 2 + guard 2），mergedTotal=6，hasMore=true
      // 滚动到底部触发 loadMoreSectionMerged（page2 返回 2 条，total=6）
      await act(async () => {
        mixedFeed.scrollTop = 1400;
        fireEvent.scroll(mixedFeed);
      });
      await waitFor(() => {
        const mergedCalls = listLiveEvents.mock.calls.filter(
          (c) => c[0].length === 2 && c[0].includes("gift") && c[0].includes("guard_buy"),
        );
        // 首屏1次 + 滚动1次 = 2次
        expect(mergedCalls).toHaveLength(2);
      });
      // page2 加载后：已加载 6 条（4+2），mergedTotal=6，hasMore=false
      // 再次滚动不应再发请求
      const callsBefore = listLiveEvents.mock.calls.length;
      await act(async () => {
        mixedFeed.scrollTop = 1400;
        fireEvent.scroll(mixedFeed);
      });
      await vi.waitFor(() => {}, { timeout: 200 });
      expect(listLiveEvents.mock.calls.length).toBe(callsBefore);
    });

    it("混排 total 不污染单类型 totalsBySection", async () => {
      mockMixedPaging();
      render(<DanmakuDashboard />);
      await screen.findByText(/辣条p1/);

      // SC 栏正常渲染（独立不受混排 total 影响）
      expect(screen.getByText("醒目留言一")).toBeTruthy();
      expect(screen.getByText("弹幕一")).toBeTruthy();

      // 混排栏触发合并请求后，单类型 totalsBySection 仍为各自首屏 total
      const mixedFeed = document.querySelector('[data-testid="gift_guard-merged-feed"]') as HTMLElement;
      expect(mixedFeed).not.toBeNull();
      await act(async () => {
        mixedFeed.scrollTop = 1400;
        fireEvent.scroll(mixedFeed);
      });
      await waitFor(() => {
        const mergedCalls = listLiveEvents.mock.calls.filter(
          (c) => c[0].length === 2 && c[0].includes("gift") && c[0].includes("guard_buy"),
        );
        // 首屏1次 + 滚动1次 = 2次
        expect(mergedCalls).toHaveLength(2);
      });
      // 逐键断言：各单类型 totalsBySection 仍为首屏各自 total（未被合并 total 污染）
      // gift 首屏 total=2，guard_buy 首屏 total=2，SC total=1，danmaku total=1
      expect(screen.getByText("醒目留言一")).toBeTruthy();
      expect(screen.getByText("弹幕一")).toBeTruthy();
    });
  });
});
