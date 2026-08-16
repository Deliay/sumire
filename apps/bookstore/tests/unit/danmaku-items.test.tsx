// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DanmakuItem from "@/features/danmaku/components/DanmakuItem";
import SuperChatItem from "@/features/danmaku/components/SuperChatItem";
import GiftItem from "@/features/danmaku/components/GiftItem";
import GuardItem from "@/features/danmaku/components/GuardItem";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = {
  uid: 1,
  name: "观众A",
  face: null,
  medal: null,
};

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return {
    occurredAt: "2026-08-16T12:00:00.000Z",
    sender: SENDER,
    read: false,
    ...partial,
  };
}

describe("DanmakuItem", () => {
  afterEach(() => cleanup());

  it("渲染弹幕文本", () => {
    render(<DanmakuItem event={makeEvent({ eventId: "dm:1", type: "danmaku", content: "来了来了" })} />);
    expect(screen.getByText("来了来了")).toBeTruthy();
  });
});

describe("SuperChatItem", () => {
  afterEach(() => cleanup());

  const sc = makeEvent({
    eventId: "sc:1",
    type: "super_chat",
    content: "首播加油",
    price: 30,
    scColors: { backgroundStart: "#c9485b", backgroundEnd: "#a12c46", fontColor: "#ffffff" },
  });

  it("两行结构：Sender + 金额行与留言气泡（scColors 渐变/文字色）", () => {
    render(<SuperChatItem event={sc} />);
    expect(screen.getByText("¥30")).toBeTruthy();
    const bubble = screen.getByText("首播加油");
    const bubbleStyle = bubble.getAttribute("style") ?? "";
    expect(bubbleStyle).toContain("linear-gradient");
    // jsdom 将 hex 序列化为 rgb()
    expect(bubbleStyle).toContain("rgb(201, 72, 91)");
    expect(bubbleStyle).toContain("rgb(161, 44, 70)");
    expect(bubbleStyle).toContain("rgb(255, 255, 255)");
  });

  it("已读时置灰（read=true 带置灰层）", () => {
    const { container } = render(<SuperChatItem event={{ ...sc, read: true }} />);
    expect(container.firstElementChild?.className).toContain("opacity-60");
  });

  it("双击切换已读：未读→read", () => {
    const onToggleRead = vi.fn();
    const { container } = render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    fireEvent.doubleClick(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleRead.mock.calls[0][0].eventId).toBe("sc:1");
  });

  it("member 角色（无 onToggleRead）不渲染已读交互", () => {
    const { container } = render(<SuperChatItem event={sc} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("cursor-pointer");
    expect(root.className).not.toContain("select-none");
    fireEvent.doubleClick(root); // 不应抛错
  });
});

describe("GiftItem", () => {
  afterEach(() => cleanup());

  it("渲染礼物名称 + 数量 + 价值（元）", () => {
    render(
      <GiftItem
        event={makeEvent({
          eventId: "gift:1",
          type: "gift",
          price: 19.8,
          gift: { name: "情书", count: 3 },
        })}
      />,
    );
    expect(screen.getByText(/情书/)).toBeTruthy();
    expect(screen.getByText(/×\s*3/)).toBeTruthy();
    expect(screen.getByText("¥19.8")).toBeTruthy();
  });
});

describe("GuardItem", () => {
  afterEach(() => cleanup());

  const guard = makeEvent({
    eventId: "guard:1:100",
    type: "guard_buy",
    price: 138,
    guard: { level: 3, name: "舰长", count: 1 },
  });

  it("guard_level 3 → 舰长，含金额与数量（月数）", () => {
    render(<GuardItem event={guard} />);
    expect(screen.getByText(/舰长/)).toBeTruthy();
    expect(screen.getByText("¥138")).toBeTruthy();
    expect(screen.getByText(/×\s*1/)).toBeTruthy();
  });

  it("guard_level 2/1 → 提督/总督；未知等级回退上游名称", () => {
    render(
      <GuardItem event={{ ...guard, guard: { level: 2, name: "提督", count: 2 } }} />,
    );
    expect(screen.getByText(/提督/)).toBeTruthy();
    cleanup();
    render(
      <GuardItem event={{ ...guard, guard: { level: 1, name: "总督", count: 1 } }} />,
    );
    expect(screen.getByText(/总督/)).toBeTruthy();
    cleanup();
    render(
      <GuardItem event={{ ...guard, guard: { level: 0, name: "神秘船票", count: 1 } }} />,
    );
    expect(screen.getByText(/神秘船票/)).toBeTruthy();
  });

  it("已读置灰 + 双击切换", () => {
    const onToggleRead = vi.fn();
    const { container } = render(
      <GuardItem event={{ ...guard, read: true }} onToggleRead={onToggleRead} />,
    );
    expect(container.firstElementChild?.className).toContain("opacity-60");
    fireEvent.doubleClick(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
  });
});
