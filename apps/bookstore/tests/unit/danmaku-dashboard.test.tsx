// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import type { Role } from "@/features/backdoor/api";

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

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", face: null, medal: null };

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

describe("DanmakuDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentRole = "admin";
    // jsdom 无布局：virtualizer 经 offsetWidth/offsetHeight 实测视口，stub 固定尺寸
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    mockListLiveEvents();
    markLiveEventRead.mockResolvedValue({ status: 200, data: { ok: true } });
    markLiveEventUnread.mockResolvedValue({ status: 200, data: { ok: true } });
    markAllLiveEventsRead.mockResolvedValue({ status: 200, data: { ok: true, marked: 1 } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("默认三栏渲染并按类型分栏加载历史事件", async () => {
    render(<DanmakuDashboard />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();
    expect(screen.getByText("醒目留言一")).toBeTruthy();
    expect(screen.getByText(/辣条/)).toBeTruthy();
    // 三栏各自的检索请求（弹幕 | SC | 礼物+上船）
    const calledTypes = listLiveEvents.mock.calls.map((c) => c[0]);
    expect(calledTypes).toContainEqual(["danmaku"]);
    expect(calledTypes).toContainEqual(["super_chat"]);
    expect(calledTypes).toContainEqual(["gift", "guard_buy"]);
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
});
