// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import type { LiveEvent, LiveEventType } from "@/features/danmaku/types";
import EventTimeline from "@/features/recordings/replay/EventTimeline";

const START_MS = Date.parse("2026-09-17T10:00:00.000Z");
const SENDER: LiveEvent["sender"] = {
  uid: 1,
  name: "观众",
  nameRomaji: null,
  face: null,
  medal: null,
  guardLevel: null,
};

function makeEvent(eventId: string, type: LiveEventType, offsetSeconds: number, extra: Partial<LiveEvent> = {}): LiveEvent {
  return {
    eventId,
    type,
    occurredAt: new Date(START_MS + offsetSeconds * 1000).toISOString(),
    sender: SENDER,
    read: false,
    ...extra,
  };
}

const EVENTS: LiveEvent[] = [
  makeEvent("dm:1", "danmaku", 40, { content: "弹幕四" }),
  makeEvent("dm:2", "danmaku", 10, { content: "弹幕十" }),
  makeEvent("sc:1", "super_chat", 20, { content: "SC留言", price: 30, scColors: { backgroundStart: "#111", backgroundEnd: "#222", fontColor: "#fff" } }),
  makeEvent("gift:1", "gift", 30, { price: 10, gift: { name: "情书", count: 1 } }),
  makeEvent("guard:1", "guard_buy", 5, { price: 138, guard: { level: 3, name: "舰长", count: 1 } }),
];

function renderTimeline(overrides: Partial<Parameters<typeof EventTimeline>[0]> = {}) {
  return render(
    <EventTimeline
      events={EVENTS}
      loading={false}
      error={false}
      onRetry={vi.fn()}
      currentTime={0}
      recordStartMs={START_MS}
      onSeek={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  vi.restoreAllMocks();
});

describe("EventTimeline 事件列表", () => {
  it("四类事件按发生时间升序渲染，条目无已读语义", () => {
    const { container } = renderTimeline();
    const ids = Array.from(container.querySelectorAll("[data-timeline-event]")).map((el) =>
      el.getAttribute("data-timeline-event"),
    );
    expect(ids).toEqual(["guard:1", "dm:2", "sc:1", "gift:1", "dm:1"]);
    // 复用弹幕看板条目：无「单击切换已读」title
    expect(screen.queryAllByTitle("单击切换已读")).toHaveLength(0);
  });

  it("currentTime 驱动自动滚动跟随与当前事件高亮", () => {
    const { container } = renderTimeline({ currentTime: 15 });
    const current = container.querySelector('[data-current="true"]');
    expect(current?.getAttribute("data-timeline-event")).toBe("sc:1");
    expect((current as HTMLElement).className).toContain("ring-flower");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("手动滚动暂停跟随并显示「回到当前进度」，点击后恢复", () => {
    renderTimeline({ currentTime: 15 });
    fireEvent.wheel(screen.getByTestId("event-timeline-scroll"));
    const resume = screen.getByRole("button", { name: "回到当前进度" });

    fireEvent.click(resume);
    expect(screen.queryByRole("button", { name: "回到当前进度" })).toBeNull();
  });

  it("点击条目以相对偏移秒调用 onSeek", () => {
    const onSeek = vi.fn();
    const { container } = renderTimeline({ onSeek });
    const gift = container.querySelector('[data-timeline-event="gift:1"]') as HTMLElement;
    fireEvent.click(gift);
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it("条目键盘可达：Enter/Space 触发跳转", () => {
    const onSeek = vi.fn();
    const { container } = renderTimeline({ onSeek });
    const gift = container.querySelector('[data-timeline-event="gift:1"]') as HTMLElement;
    expect(gift.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(gift, { key: "Enter" });
    expect(onSeek).toHaveBeenCalledWith(30);
    fireEvent.keyDown(gift, { key: " " });
    expect(onSeek).toHaveBeenCalledTimes(2);
  });

  it("加载失败展示错误态，点击重试调用 onRetry", () => {
    const onRetry = vi.fn();
    renderTimeline({ error: true, events: [], onRetry });
    expect(screen.getByText(/弹幕事件加载失败/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("无事件时展示空态文案", () => {
    renderTimeline({ events: [] });
    expect(screen.getByText("本场直播暂无弹幕事件")).toBeTruthy();
  });
});
