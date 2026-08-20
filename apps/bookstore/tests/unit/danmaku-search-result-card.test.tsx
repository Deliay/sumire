// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SearchResultCard from "@/features/danmaku/search/components/SearchResultCard";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = {
  uid: 1,
  name: "观众A",
  nameRomaji: null,
  face: null,
  medal: null,
  guardLevel: null,
};

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return {
    occurredAt: "2026-08-16T12:00:00.000Z",
    sender: SENDER,
    read: false,
    ...partial,
  };
}

describe("SearchResultCard", () => {
  afterEach(() => cleanup());

  const keyword = "test";

  it("danmaku 类型渲染弹幕卡片结构（含 Sender compact + 时间 + 内容高亮）", () => {
    const event = makeEvent({ eventId: "dm:1", type: "danmaku", content: "test message" });
    const { container } = render(<SearchResultCard event={event} keyword={keyword} />);
    // 应包含 Sender compact
    expect(container.querySelector('[class*="text-xs"]')).toBeTruthy();
    // 应包含高亮 mark
    expect(screen.getByText("test")).toBeTruthy();
    // 应包含时间
    expect(screen.getByText(/\d{2}\/\d{2}\s\d{2}:\d{2}/)).toBeTruthy();
  });

  it("super_chat 类型渲染 SuperChatItem 结构（含价格、留言高亮）", () => {
    const event = makeEvent({
      eventId: "sc:1",
      type: "super_chat",
      content: "test sc",
      price: 30,
      scColors: { backgroundStart: "#c9485b", backgroundEnd: "#a12c46", fontColor: "#ffffff" },
    });
    const { container } = render(<SearchResultCard event={event} keyword={keyword} />);
    // 应包含价格
    expect(screen.getByText("¥30")).toBeTruthy();
    // 应包含高亮标记
    const marks = screen.getAllByText("test");
    expect(marks.length).toBe(1);
    expect(marks[0].tagName).toBe("MARK");
    // 应包含 Sender
    expect(container.querySelector('[class*="text-xs"]')).toBeTruthy();
  });

  it("gift 类型渲染 GiftItem 结构（含礼物名称、数量、价值）", () => {
    const event = makeEvent({
      eventId: "gift:1",
      type: "gift",
      price: 19.8,
      gift: { name: "情书", count: 3 },
    });
    const { container } = render(<SearchResultCard event={event} keyword={keyword} />);
    // 应包含礼物名称
    expect(screen.getByText(/情书/)).toBeTruthy();
    // 应包含数量
    expect(screen.getByText(/×\s*3/)).toBeTruthy();
    // 应包含价值
    expect(screen.getByText("¥19.8")).toBeTruthy();
    // 应包含 Sender
    expect(container.querySelector('[class*="text-xs"]')).toBeTruthy();
  });

  it("guard_buy 类型渲染 GuardItem 结构（含船型、金额、数量）", () => {
    const event = makeEvent({
      eventId: "guard:1:100",
      type: "guard_buy",
      price: 138,
      guard: { level: 3, name: "舰长", count: 1 },
    });
    const { container } = render(<SearchResultCard event={event} keyword={keyword} />);
    // 应包含船型名称
    expect(screen.getByText(/舰长/)).toBeTruthy();
    // 应包含金额
    expect(screen.getByText("¥138")).toBeTruthy();
    // 应包含数量
    expect(screen.getByText(/1\s*个月/)).toBeTruthy();
    // 应包含 Sender
    expect(container.querySelector('[class*="text-xs"]')).toBeTruthy();
  });

  it("未知类型兜底渲染弹幕卡片，不抛错", () => {
    const event = makeEvent({ eventId: "unknown:1", type: "unknown_type" as LiveEvent["type"], content: "fallback" });
    expect(() => {
      render(<SearchResultCard event={event} keyword={keyword} />);
    }).not.toThrow();
    // 应包含内容
    expect(screen.getByText("fallback")).toBeTruthy();
  });

  it("非 danmaku 类型均不渲染 onDoubleClick 交互与「New」标记", () => {
    const scEvent = makeEvent({
      eventId: "sc:2",
      type: "super_chat",
      content: "sc test",
      price: 10,
    });
    const { container: scContainer } = render(<SearchResultCard event={scEvent} keyword={keyword} />);
    const scRoot = scContainer.firstElementChild as HTMLElement;
    expect(scRoot.className).not.toContain("cursor-pointer");
    expect(screen.queryByText("New")).toBeNull();

    cleanup();

    const giftEvent = makeEvent({
      eventId: "gift:2",
      type: "gift",
      price: 1,
      gift: { name: "打call", count: 1 },
    });
    const { container: giftContainer } = render(<SearchResultCard event={giftEvent} keyword={keyword} />);
    const giftRoot = giftContainer.firstElementChild as HTMLElement;
    expect(giftRoot.className).not.toContain("cursor-pointer");
    expect(screen.queryByText("New")).toBeNull();

    cleanup();

    const guardEvent = makeEvent({
      eventId: "guard:2:200",
      type: "guard_buy",
      price: 138,
      guard: { level: 3, name: "舰长", count: 1 },
    });
    const { container: guardContainer } = render(<SearchResultCard event={guardEvent} keyword={keyword} />);
    const guardRoot = guardContainer.firstElementChild as HTMLElement;
    expect(guardRoot.className).not.toContain("cursor-pointer");
    expect(screen.queryByText("New")).toBeNull();
  });

  it("danmaku 类型同样不渲染 onDoubleClick 交互与「New」标记（只读模式）", () => {
    const event = makeEvent({ eventId: "dm:2", type: "danmaku", content: "readonly danmaku" });
    const { container } = render(<SearchResultCard event={event} keyword={keyword} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("cursor-pointer");
    expect(screen.queryByText("New")).toBeNull();
  });
});