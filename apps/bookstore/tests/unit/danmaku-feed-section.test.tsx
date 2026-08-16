// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import FeedSection from "@/features/danmaku/components/FeedSection";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null };

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return { occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, ...partial };
}

const EVENTS: LiveEvent[] = Array.from({ length: 20 }, (_, i) =>
  makeEvent({ eventId: `dm:${i}`, type: "danmaku", content: `弹幕${i}` }),
);

describe("FeedSection 滚动加载", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hasMore 时渲染「加载更多」按钮，点击触发 onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(<FeedSection label="弹幕" events={EVENTS} canManage={false} onLoadMore={onLoadMore} hasMore />);
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("无更多（hasMore=false）时不渲染「加载更多」按钮", () => {
    render(<FeedSection label="弹幕" events={EVENTS} canManage={false} hasMore={false} />);
    expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
  });

  it("回归：短列表（scrollHeight <= clientHeight，未铺满）即使 hasMore 也不自动触发 onLoadMore（防无限加载）", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    const onLoadMore = vi.fn();
    const few = EVENTS.slice(0, 2);
    render(<FeedSection label="弹幕" events={few} canManage={false} onLoadMore={onLoadMore} hasMore />);
    await act(async () => {});
    expect(onLoadMore).not.toHaveBeenCalled();
    // 短列表仍渲染手动「加载更多」按钮
    expect(screen.getByRole("button", { name: "加载更多" })).toBeTruthy();
  });

  it("滚动接近底部触发 onLoadMore", async () => {
    const onLoadMore = vi.fn();
    render(<FeedSection label="弹幕" events={EVENTS} canManage={false} onLoadMore={onLoadMore} hasMore />);
    const feed = document.querySelector('[aria-label="弹幕信息流"]') as HTMLElement;
    await act(async () => {
      feed.scrollTop = 1400;
      fireEvent.scroll(feed);
    });
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("loadingMore 时展示加载提示且不触发 onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(<FeedSection label="弹幕" events={EVENTS} canManage={false} onLoadMore={onLoadMore} hasMore loadingMore />);
    expect(screen.getByText("加载中…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "加载更多" })).toBeNull();
  });
});

describe("FeedSection 弹幕折叠", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("相邻重复弹幕折叠为一行并展示计数，而非重复弹幕各自展示", () => {
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:a", type: "danmaku", content: "妈妈妈妈妈" }),
      makeEvent({ eventId: "dm:b", type: "danmaku", content: "妈妈妈" }),
      makeEvent({ eventId: "dm:c", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:d", type: "danmaku", content: "欢迎欢迎" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} />);
    expect(screen.getByText("×3")).toBeTruthy();
    expect(screen.queryByText("×1")).toBeNull();
  });

  it("非连续重复弹幕同样折叠（跨其他事件）", () => {
    const events: LiveEvent[] = [
      makeEvent({ eventId: "dm:1", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:2", type: "danmaku", content: "欢迎欢迎" }),
      makeEvent({ eventId: "dm:3", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={events} canManage={false} />);
    expect(screen.getByText("×2")).toBeTruthy();
  });

  it("折叠使短列表未铺满时自动向下加载一条填充（hasMore）", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    const onLoadMore = vi.fn();
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:1", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:2", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} onLoadMore={onLoadMore} hasMore />);
    await act(async () => {});
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("未折叠的短列表不自动加载（保留防无限加载回归）", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    const onLoadMore = vi.fn();
    const few = EVENTS.slice(0, 2);
    render(<FeedSection label="弹幕" events={few} canManage={false} onLoadMore={onLoadMore} hasMore />);
    await act(async () => {});
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "加载更多" })).toBeTruthy();
  });
});

describe("FeedSection New 标记（实时流 SC/上船）", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("newIds 命中 SC/上船 eventId 时渲染「New」标记", () => {
    const sc = makeEvent({ eventId: "sc:1", type: "super_chat", content: "醒目留言", price: 30 });
    const guard = makeEvent({ eventId: "guard:1", type: "guard_buy", price: 138, guard: { level: 3, name: "舰长", count: 1 } });
    render(
      <FeedSection
        label="SC+上船"
        events={[sc, guard]}
        canManage={false}
        newIds={new Map([
          ["sc:1", "super_chat"],
          ["guard:1", "guard_buy"],
        ])}
      />,
    );
    expect(screen.getAllByText("New")).toHaveLength(2);
  });

  it("newIds 未命中（历史事件）不渲染「New」标记", () => {
    const sc = makeEvent({ eventId: "sc:1", type: "super_chat", content: "醒目留言", price: 30 });
    render(<FeedSection label="SC" events={[sc]} canManage={false} newIds={new Map()} />);
    expect(screen.queryByText("New")).toBeNull();
  });
});
