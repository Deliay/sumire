// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import FeedColumn from "@/features/danmaku/components/FeedColumn";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", face: null, medal: null };

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return { occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, ...partial };
}

const EVENTS: LiveEvent[] = [
  makeEvent({ eventId: "dm:1", type: "danmaku", content: "第一条弹幕" }),
  makeEvent({ eventId: "sc:1", type: "super_chat", content: "SC 留言", price: 30 }),
  makeEvent({ eventId: "gift:1", type: "gift", price: 19.8, gift: { name: "情书", count: 2 } }),
  makeEvent({ eventId: "guard:1:1", type: "guard_buy", price: 138, guard: { level: 3, name: "舰长", count: 1 } }),
];

describe("FeedColumn", () => {
  beforeEach(() => {
    // jsdom 无布局：virtualizer 经 offsetWidth/offsetHeight 实测视口，stub 固定尺寸
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("渲染栏标题与四类事件条目", () => {
    render(<FeedColumn title="全部" events={EVENTS} canManage={false} />);
    expect(screen.getByText("全部")).toBeTruthy();
    expect(screen.getByText("第一条弹幕")).toBeTruthy();
    expect(screen.getByText("SC 留言")).toBeTruthy();
    expect(screen.getByText(/情书/)).toBeTruthy();
    expect(screen.getByText(/舰长/)).toBeTruthy();
  });

  it("SC 列显示「标记全部已读」，需二次确认后才触发", () => {
    vi.useFakeTimers();
    const onReadAll = vi.fn();
    render(<FeedColumn title="SC" events={EVENTS} canManage onReadAll={onReadAll} readAllTypes={["super_chat"]} />);
    const btn = screen.getByRole("button", { name: /SC 全部已读/ });
    fireEvent.click(btn);
    expect(onReadAll).not.toHaveBeenCalled();
    // 二次确认态
    const confirm = screen.getByRole("button", { name: /确认全部已读/ });
    fireEvent.click(confirm);
    expect(onReadAll).toHaveBeenCalledWith("super_chat");
  });

  it("二次确认超时未点自动复位", () => {
    vi.useFakeTimers();
    const onReadAll = vi.fn();
    render(<FeedColumn title="SC" events={EVENTS} canManage onReadAll={onReadAll} readAllTypes={["super_chat"]} />);
    fireEvent.click(screen.getByRole("button", { name: /SC 全部已读/ }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(onReadAll).not.toHaveBeenCalled();
  });

  it("上船列触发 guard_buy 全部已读", () => {
    const onReadAll = vi.fn();
    render(<FeedColumn title="礼物+上船" events={EVENTS} canManage onReadAll={onReadAll} readAllTypes={["guard_buy"]} />);
    fireEvent.click(screen.getByRole("button", { name: /上船 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("guard_buy");
  });

  it("member（canManage=false）不渲染「标记全部已读」", () => {
    render(<FeedColumn title="SC" events={EVENTS} canManage={false} onReadAll={vi.fn()} readAllTypes={["super_chat"]} />);
    expect(screen.queryByRole("button", { name: /全部已读/ })).toBeNull();
  });
});
