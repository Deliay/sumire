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

function sectionsOf(events: LiveEvent[]): { type: LiveEvent["type"]; label: string; events: LiveEvent[] }[] {
  const LABELS: Record<LiveEvent["type"], string> = {
    danmaku: "弹幕",
    super_chat: "SC",
    gift: "礼物",
    guard_buy: "上船",
  };
  const byType = new Map<LiveEvent["type"], LiveEvent[]>();
  for (const e of events) {
    const list = byType.get(e.type) ?? [];
    list.push(e);
    byType.set(e.type, list);
  }
  return [...byType.entries()].map(([type, list]) => ({ type, label: LABELS[type], events: list }));
}

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
    render(<FeedColumn title="全部" sections={sectionsOf(EVENTS)} canManage={false} />);
    expect(screen.getByText("全部")).toBeTruthy();
    expect(screen.getByText("第一条弹幕")).toBeTruthy();
    expect(screen.getByText("SC 留言")).toBeTruthy();
    expect(screen.getByText(/情书/)).toBeTruthy();
    expect(screen.getByText(/舰长/)).toBeTruthy();
  });

  it("多类型栏位上下分栏：弹幕小节在礼物小节上方", () => {
    const { container } = render(
      <FeedColumn
        title="弹幕 + 礼物"
        sections={sectionsOf([
          makeEvent({ eventId: "dm:1", type: "danmaku", content: "弹幕内容" }),
          makeEvent({ eventId: "gift:1", type: "gift", price: 5, gift: { name: "辣条", count: 1 } }),
        ])}
        canManage={false}
      />,
    );
    const labels = [...container.querySelectorAll(".text-xs.font-medium.text-ink-dim")].map(
      (n) => n.textContent,
    );
    // 弹幕小节标签在礼物小节标签之前（上下分栏）
    expect(labels).toEqual(["弹幕", "礼物"]);
  });

  it("SC 列显示「标记全部已读」，需二次确认后才触发", () => {
    vi.useFakeTimers();
    const onReadAll = vi.fn();
    render(<FeedColumn title="SC" sections={sectionsOf(EVENTS)} canManage onReadAll={onReadAll} readAllTypes={["super_chat"]} />);
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
    render(<FeedColumn title="SC" sections={sectionsOf(EVENTS)} canManage onReadAll={onReadAll} readAllTypes={["super_chat"]} />);
    fireEvent.click(screen.getByRole("button", { name: /SC 全部已读/ }));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(onReadAll).not.toHaveBeenCalled();
  });

  it("上船列触发 guard_buy 全部已读", () => {
    const onReadAll = vi.fn();
    render(<FeedColumn title="上船" sections={sectionsOf(EVENTS)} canManage onReadAll={onReadAll} readAllTypes={["guard_buy"]} />);
    fireEvent.click(screen.getByRole("button", { name: /上船 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("guard_buy");
  });

  it("member（canManage=false）不渲染「标记全部已读」", () => {
    render(<FeedColumn title="SC" sections={sectionsOf(EVENTS)} canManage={false} onReadAll={vi.fn()} readAllTypes={["super_chat"]} />);
    expect(screen.queryByRole("button", { name: /全部已读/ })).toBeNull();
  });

  it("error 时显示错误提示与重试按钮，点击触发 onRetry", () => {
    const onRetry = vi.fn();
    render(<FeedColumn title="弹幕 + 礼物" sections={[]} canManage={false} error="检索失败" onRetry={onRetry} />);
    expect(screen.getByText("检索失败")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
