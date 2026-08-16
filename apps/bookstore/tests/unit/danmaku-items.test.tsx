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

  it("表情弹幕渲染表情图片（含 alt/title），不渲染纯文本", () => {
    render(
      <DanmakuItem
        event={makeEvent({
          eventId: "dm:2",
          type: "danmaku",
          content: "少女祈祷",
          emote: { url: "http://i0.hdslb.com/bfs/live/x.png", name: "少女祈祷" },
        })}
      />,
    );
    const img = screen.getByAltText("少女祈祷") as HTMLImageElement;
    expect(img.src).toContain("/x.png");
    expect(screen.queryByText("少女祈祷")).toBeNull();
  });

  it("表情按原图宽高渲染（width/height 属性），并限制最大高度", () => {
    render(
      <DanmakuItem
        event={makeEvent({
          eventId: "dm:3",
          type: "danmaku",
          content: "少女祈祷",
          emote: { url: "http://i0.hdslb.com/bfs/live/x.png", name: "少女祈祷", width: 162, height: 162 },
        })}
      />,
    );
    const img = screen.getByAltText("少女祈祷") as HTMLImageElement;
    expect(img.width).toBe(162);
    expect(img.height).toBe(162);
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("max-h-16");
    expect(img.className).toContain("w-auto");
  });

  it("小表情（emoji 风格，源图 ≤32px）缩小渲染上限为 32px（max-h-8）", () => {
    render(
      <DanmakuItem
        event={makeEvent({
          eventId: "dm:4",
          type: "danmaku",
          content: "[比心]",
          emote: { url: "http://i0.hdslb.com/bfs/live/x.png", name: "[比心]", width: 20, height: 20 },
        })}
      />,
    );
    const img = screen.getByAltText("[比心]") as HTMLImageElement;
    expect(img.className).toContain("max-h-8");
    expect(img.className).not.toContain("max-h-16");
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

  it("礼物类型标识：左竖条（primary）+ 「礼物」chip", () => {
    const { container } = render(
      <GiftItem
        event={makeEvent({
          eventId: "gift:2",
          type: "gift",
          price: 1,
          gift: { name: "打call", count: 1 },
        })}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.querySelector("span.bg-primary\\/70")).toBeTruthy();
    expect(screen.getByText("礼物")).toBeTruthy();
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
    expect(screen.getByText(/1\s*个月/)).toBeTruthy();
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

  it("上船类型标识：左竖条（flower）+ 「上船 · 舰长」chip", () => {
    const { container } = render(<GuardItem event={guard} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.querySelector("span.bg-flower\\/70")).toBeTruthy();
    expect(screen.getByText("上船 · 舰长")).toBeTruthy();
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
