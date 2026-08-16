// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import type { Role } from "@/features/backdoor/api";
import { COLUMN_PRESETS, COLUMNS_STORAGE_KEY } from "@/features/danmaku/columns";

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

import DanmakuDashboard from "@/features/danmaku/components/DanmakuDashboard";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null };

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return { occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, ...partial };
}

const SC_EVENT = makeEvent({ eventId: "sc:1", type: "super_chat", content: "醒目留言一", price: 30 });
const DM_EVENT = makeEvent({ eventId: "dm:1", type: "danmaku", content: "弹幕一" });
const GIFT_EVENT = makeEvent({ eventId: "gift:1", type: "gift", price: 5, gift: { name: "辣条", count: 1 } });

function mockListLiveEvents() {
  listLiveEvents.mockImplementation(async (types: string[]) => {
    const items = [SC_EVENT, DM_EVENT, GIFT_EVENT].filter((e) => types.includes(e.type));
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
  });

  it("默认三栏渲染并按类型分栏加载历史事件", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    expect(screen.getByText(/辣条/)).toBeTruthy();
    // 每节（栏 + 类型）独立检索请求：礼物+上船 | SC | 弹幕
    const calledTypes = listLiveEvents.mock.calls.map((c) => c[0]);
    expect(calledTypes).toContainEqual(["gift"]);
    expect(calledTypes).toContainEqual(["guard_buy"]);
    expect(calledTypes).toContainEqual(["super_chat"]);
    expect(calledTypes).toContainEqual(["danmaku"]);
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

  it("member 双击不触发已读交互，也无全部已读按钮", async () => {
    currentRole = "member";
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    fireEvent.doubleClick(row);
    expect(markLiveEventRead).not.toHaveBeenCalled();
    expect(markLiveEventUnread).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /全部已读/ })).toBeNull();
  });

  it("「标记全部已读」后该类型事件整体置灰", async () => {
    render(<DanmakuDashboard />);
    const row = (await screen.findByText("醒目留言一")).closest("[data-event-id]") as HTMLElement;
    fireEvent.click(await screen.findByRole("button", { name: /SC 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
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

  it("narrow(<640) 折叠为单栏全类型，无视图栏选择器，配置面板全部勾选", async () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    render(<DanmakuDashboard />);

    // 单栏渲染全部四类事件
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    expect(screen.getByText(/辣条/)).toBeTruthy();

    // 无视图栏选择器
    expect(screen.queryByRole("combobox", { name: "视图栏" })).toBeNull();

    // 打开配置面板：全部四类勾选
    fireEvent.click(screen.getByRole("button", { name: /配置「弹幕/ }));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
    for (const cb of checkboxes) expect((cb as HTMLInputElement).checked).toBe(true);
  });

  it("medium(640-1023) 视图栏选择器仅 1/2 栏，默认 1 栏（单栏全类型）", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": false });
    render(<DanmakuDashboard />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["1 栏", "2 栏"]);
    expect(select.value).toBe("1");

    // 默认单栏渲染全部四类
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
  });

  it("medium 选择 2 栏后按预设分组（上船+SC | 礼物+弹幕）并持久化", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": false });
    render(<DanmakuDashboard />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });

    expect(await screen.findByText("上船 + SC")).toBeTruthy();
    expect(screen.getByText("礼物 + 弹幕")).toBeTruthy();

    const stored = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    expect(stored).toEqual(COLUMN_PRESETS[2]);
  });

  it("wide(>=1024) 视图栏选择器仅 2/3 栏，默认 3 栏", async () => {
    render(<DanmakuDashboard />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["2 栏", "3 栏"]);
    expect(select.value).toBe("3");
  });

  it("wide 选择 2 栏后切换为 2 栏预设并持久化", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });

    expect(await screen.findByText("上船 + SC")).toBeTruthy();
    const stored = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    expect(stored).toEqual(COLUMN_PRESETS[2]);
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
});
