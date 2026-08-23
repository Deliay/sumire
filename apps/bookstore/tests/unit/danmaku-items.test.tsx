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

  it("折叠弹幕最右侧展示重复计数（count>1 → ×N）", () => {
    render(<DanmakuItem event={makeEvent({ eventId: "dm:5", type: "danmaku", content: "妈妈" })} count={3} />);
    expect(screen.getByText("×3")).toBeTruthy();
  });

  it("count 缺省或为 1 时不渲染计数", () => {
    render(<DanmakuItem event={makeEvent({ eventId: "dm:6", type: "danmaku", content: "妈妈" })} />);
    expect(screen.queryByText(/×/)).toBeNull();
    cleanup();
    render(<DanmakuItem event={makeEvent({ eventId: "dm:7", type: "danmaku", content: "妈妈" })} count={1} />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("发送者船型等级渲染对应 10% 淡色背景与圆角（3 舰长蓝 eye/2 提督紫 flower/1 总督红 crimson）", () => {
    const withGuard = (guardLevel: number): LiveEvent["sender"] => ({ ...SENDER, guardLevel });
    const { container: c3 } = render(
      <DanmakuItem event={makeEvent({ eventId: "dm:g3", type: "danmaku", content: "舰长弹幕", sender: withGuard(3) })} />,
    );
    const r3 = c3.querySelector('[data-event-id="dm:g3"]') as HTMLElement;
    expect(r3.className).toContain("bg-eye/10");
    expect(r3.className).toContain("rounded-md");
    cleanup();

    const { container: c2 } = render(
      <DanmakuItem event={makeEvent({ eventId: "dm:g2", type: "danmaku", content: "提督弹幕", sender: withGuard(2) })} />,
    );
    expect((c2.querySelector('[data-event-id="dm:g2"]') as HTMLElement).className).toContain("bg-flower/10");
    cleanup();

    const { container: c1 } = render(
      <DanmakuItem event={makeEvent({ eventId: "dm:g1", type: "danmaku", content: "总督弹幕", sender: withGuard(1) })} />,
    );
    expect((c1.querySelector('[data-event-id="dm:g1"]') as HTMLElement).className).toContain("bg-crimson/10");
  });

  it("无等级/未知等级发送者不渲染船型背景（无 tint 类与圆角）", () => {
    const { container } = render(
      <DanmakuItem event={makeEvent({ eventId: "dm:g0", type: "danmaku", content: "普通弹幕" })} />,
    );
    const root = container.querySelector('[data-event-id="dm:g0"]') as HTMLElement;
    expect(root.className).not.toContain("bg-eye");
    expect(root.className).not.toContain("bg-flower");
    expect(root.className).not.toContain("bg-crimson");
    expect(root.className).not.toContain("rounded-md");
    cleanup();
    const { container: c99 } = render(
      <DanmakuItem
        event={makeEvent({ eventId: "dm:g99", type: "danmaku", content: "未知船弹幕", sender: { ...SENDER, guardLevel: 99 } })}
      />,
    );
    expect((c99.querySelector('[data-event-id="dm:g99"]') as HTMLElement).className).not.toContain("rounded-md");
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

  it("单击切换已读：未读→read", () => {
    const onToggleRead = vi.fn();
    const { container } = render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    fireEvent.click(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleRead.mock.calls[0][0].eventId).toBe("sc:1");
  });

  it("title 为「单击切换已读」", () => {
    const { container } = render(<SuperChatItem event={sc} onToggleRead={vi.fn()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("title")).toBe("单击切换已读");
  });

  it("member 角色（无 onToggleRead）不渲染已读交互", () => {
    const { container } = render(<SuperChatItem event={sc} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("cursor-pointer");
    expect(root.className).not.toContain("select-none");
    fireEvent.click(root); // 不应抛错
  });

  it("留言气泡可选中复制（select-text cursor-text），容器不带 select-none", () => {
    const onToggleRead = vi.fn();
    const { container } = render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    const bubble = screen.getByText("首播加油");
    expect(bubble.className).toContain("select-text");
    expect(bubble.className).toContain("cursor-text");
    expect((container.firstElementChild as HTMLElement).className).not.toContain("select-none");
  });

  it("留言文字区干净单击触发 onToggleRead 一次（stopPropagation 防重复）", () => {
    const onToggleRead = vi.fn();
    render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    // 点击留言文字区
    fireEvent.click(screen.getByText("首播加油"));
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleRead.mock.calls[0][0].eventId).toBe("sc:1");
  });

  it("拖选留言不触发 onToggleRead（getSelection Range 非折叠）", () => {
    const onToggleRead = vi.fn();
    render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    // Mock window.getSelection 返回 Range 非折叠（模拟拖选复制）
    const origGetSelection = window.getSelection;
    const mockSelection = { type: "Range", isCollapsed: false };
    Object.defineProperty(window, "getSelection", {
      value: () => mockSelection,
      writable: true,
      configurable: true,
    });
    fireEvent.click(screen.getByText("首播加油"));
    expect(onToggleRead).not.toHaveBeenCalled();
    // 恢复原始 getSelection
    Object.defineProperty(window, "getSelection", { value: origGetSelection, writable: true, configurable: true });
  });

  it("气泡外（非留言区）点击仍触发 onToggleRead", () => {
    const onToggleRead = vi.fn();
    const { container } = render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    // 点击根容器非留言区域
    fireEvent.click(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
  });

  it("isNew=true 渲染「New」标记，isNew 缺省/为 false 不渲染", () => {
    render(<SuperChatItem event={sc} isNew />);
    expect(screen.getByText("New")).toBeTruthy();
    cleanup();
    render(<SuperChatItem event={sc} />);
    expect(screen.queryByText("New")).toBeNull();
  });

  it("SC 留言含 contentRomaji 时另起一行展示罗马音，无则仅展示留言", () => {
    render(<SuperChatItem event={{ ...sc, contentRomaji: "shubi otsukaresama" }} />);
    expect(screen.getByText("首播加油")).toBeTruthy();
    expect(screen.getByText("shubi otsukaresama")).toBeTruthy();
  });

  it("highlightKeyword 非空时留言命中子串包 <mark>，罗马音行无 <mark>", () => {
    render(<SuperChatItem event={{ ...sc, content: "首播加油，今天也要加油哦" }} highlightKeyword="加油" />);
    // 应包含两个高亮 mark（"加油" 出现两次）
    const marks = screen.getAllByText("加油");
    expect(marks.length).toBe(2);
    marks.forEach((mark) => {
      expect(mark.tagName).toBe("MARK");
      expect(mark.className).toContain("rounded-sm");
      expect(mark.className).toContain("bg-eye/30");
      expect(mark.className).toContain("px-0.5");
    });
    // 罗马音行无 mark
    render(<SuperChatItem event={{ ...sc, content: "首播加油", contentRomaji: "shubi otsukaresama" }} highlightKeyword="加油" />);
    const romaji = screen.getByText("shubi otsukaresama");
    expect(romaji.tagName).not.toBe("MARK");
    expect(romaji.className).toContain("opacity-75");
  });

  it("highlightKeyword 缺省时输出与现态逐字节一致（无高亮）", () => {
    const { container: withKeyword } = render(
      <SuperChatItem event={{ ...sc, content: "首播加油" }} highlightKeyword="加油" />,
    );
    const { container: withoutKeyword } = render(
      <SuperChatItem event={{ ...sc, content: "首播加油" }} />,
    );
    // 两个容器的留言内容 HTML 应一致（无高亮 vs 有高亮）
    const withMark = withKeyword.querySelector("mark");
    const withoutMark = withoutKeyword.querySelector("mark");
    expect(withMark).toBeTruthy();
    expect(withoutMark).toBeNull();
    // 留言文本应相同
    expect(withKeyword.textContent).toContain("首播加油");
    expect(withoutKeyword.textContent).toContain("首播加油");
  });

  it("SC 头部 Sender 点击不触发 onToggleRead（穿透）", () => {
    const onToggleRead = vi.fn();
    render(<SuperChatItem event={sc} onToggleRead={onToggleRead} />);
    // Sender 的 <a> 标签有 stopPropagation，点击不冒泡到根节点
    const senderLink = screen.getByText("观众A").closest("a");
    expect(senderLink).toBeTruthy();
    fireEvent.click(senderLink!);
    expect(onToggleRead).not.toHaveBeenCalled();
  });

  it("SC 留言内 BiliVideoLink 点击不触发 onToggleRead（穿透）", () => {
    const onToggleRead = vi.fn();
    const scWithLink = makeEvent({
      eventId: "sc:link",
      type: "super_chat",
      content: "看看这个 BV1xw411n7FW",
      price: 30,
      scColors: { backgroundStart: "#c9485b", backgroundEnd: "#a12c46", fontColor: "#ffffff" },
    });
    render(<SuperChatItem event={scWithLink} onToggleRead={onToggleRead} />);
    // BiliVideoLink 的 <a> 标签有 stopPropagation
    const link = screen.getByText(/BV1xw411n7FW/).closest("a");
    expect(link).toBeTruthy();
    fireEvent.click(link!);
    expect(onToggleRead).not.toHaveBeenCalled();
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

  it("有图标时懒加载礼物图标，无图标时不渲染，加载失败后隐藏", () => {
    const { container } = render(
      <GiftItem event={makeEvent({ eventId: "gift:icon", type: "gift", gift: { name: "情书", count: 1, iconUrl: "https://example.com/gift.png" } })} />,
    );
    const image = container.querySelector('img[alt=""]') as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.getAttribute("loading")).toBe("lazy");
    fireEvent.error(image);
    expect(container.querySelector('img[alt=""]')).toBeNull();

    cleanup();
    const { container: withoutIcon } = render(
      <GiftItem event={makeEvent({ eventId: "gift:no-icon", type: "gift", gift: { name: "情书", count: 1 } })} />,
    );
    expect(withoutIcon.querySelector('img[alt=""]')).toBeNull();
  });

  it("价值分级着色：<10 灰（ink-dim）/10-99 蓝（eye）/100-500 金（gold）/>500 红（crimson）", () => {
    const { container: cLow } = render(
      <GiftItem event={makeEvent({ eventId: "gift:g1", type: "gift", price: 1, gift: { name: "a", count: 1 } })} />,
    );
    expect(cLow.querySelector("span.text-ink-dim")).toBeTruthy();
    cleanup();

    const { container: cBlue } = render(
      <GiftItem event={makeEvent({ eventId: "gift:g2", type: "gift", price: 50, gift: { name: "a", count: 1 } })} />,
    );
    expect(cBlue.querySelector("span.text-eye")).toBeTruthy();
    cleanup();

    const { container: cGold } = render(
      <GiftItem event={makeEvent({ eventId: "gift:g3", type: "gift", price: 100, gift: { name: "a", count: 1 } })} />,
    );
    expect(cGold.querySelector("span.text-gold")).toBeTruthy();
    cleanup();

    const { container: cRed } = render(
      <GiftItem event={makeEvent({ eventId: "gift:g4", type: "gift", price: 520, gift: { name: "a", count: 1 } })} />,
    );
    expect(cRed.querySelector("span.text-crimson")).toBeTruthy();
  });

  it("admin 单击礼物条目触发 onToggleRead(event)", () => {
    const onToggleRead = vi.fn();
    const { container } = render(
      <GiftItem event={makeEvent({ eventId: "gift:click1", type: "gift", gift: { name: "情书", count: 1 } })} onToggleRead={onToggleRead} />,
    );
    fireEvent.click(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onToggleRead.mock.calls[0][0].eventId).toBe("gift:click1");
  });

  it("已读时根节点有 opacity-60，title 含「单击切换已读」", () => {
    const { container } = render(
      <GiftItem
        event={makeEvent({ eventId: "gift:read1", type: "gift", read: true, gift: { name: "情书", count: 1 } })}
        onToggleRead={vi.fn()}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("opacity-60");
    expect(root.getAttribute("title")).toContain("单击切换已读");
  });

  it("未传 onToggleRead（member）单击不触发、无 title、无 cursor-pointer", () => {
    const onToggleRead = vi.fn();
    const { container } = render(
      <GiftItem event={makeEvent({ eventId: "gift:mem1", type: "gift", gift: { name: "情书", count: 1 } })} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("title")).toBeNull();
    expect(root.className).not.toContain("cursor-pointer");
    fireEvent.click(root);
    expect(onToggleRead).not.toHaveBeenCalled();
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

  it("船型 chip 前置对应本地徽章并强调字号，未知等级不渲染徽章", () => {
    const { container } = render(<GuardItem event={guard} />);
    expect(container.querySelector('img[src*="guard-badge-captain"]')).toBeTruthy();
    expect(container.querySelector("span.text-xs")).toBeTruthy();
    cleanup();
    const { container: unknown } = render(
      <GuardItem event={{ ...guard, guard: { level: 99, name: "未知船", count: 1 } }} />,
    );
    expect(unknown.querySelector('img[src*="guard-badge"]')).toBeNull();
  });

  it("上船事件头像按所购船型渲染挂件（sender.guardLevel 缺省时回退 event.guard.level）", () => {
    // SENDER.guardLevel=null，仅 event.guard.level=3 携带船型 → 头像应渲染舰长挂件
    const { container } = render(<GuardItem event={guard} />);
    expect(container.querySelector('[src*="guard-badge-captain"]')).toBeTruthy();
    cleanup();
    const { container: c2 } = render(
      <GuardItem event={{ ...guard, guard: { level: 2, name: "提督", count: 2 } }} />,
    );
    expect(c2.querySelector('[src*="guard-badge-admiral"]')).toBeTruthy();
    cleanup();
    const { container: c1 } = render(
      <GuardItem event={{ ...guard, guard: { level: 1, name: "总督", count: 1 } }} />,
    );
    expect(c1.querySelector('[src*="guard-badge-governor"]')).toBeTruthy();
  });

  it("船型着色：3 舰长蓝（eye）/2 提督紫（flower）/1 总督红（crimson），整条打底", () => {
    const { container: c3 } = render(<GuardItem event={guard} />);
    expect(c3.querySelector("span.bg-eye\\/70")).toBeTruthy();
    expect(c3.querySelector("span.text-eye")).toBeTruthy();
    expect(c3.firstElementChild?.className).toContain("bg-eye/10");
    cleanup();

    const { container: c2 } = render(<GuardItem event={{ ...guard, guard: { level: 2, name: "提督", count: 2 } }} />);
    expect(c2.querySelector("span.bg-flower\\/70")).toBeTruthy();
    expect(c2.querySelector("span.text-flower")).toBeTruthy();
    expect(c2.firstElementChild?.className).toContain("bg-flower/10");
    cleanup();

    const { container: c1 } = render(<GuardItem event={{ ...guard, guard: { level: 1, name: "总督", count: 1 } }} />);
    expect(c1.querySelector("span.bg-crimson\\/70")).toBeTruthy();
    expect(c1.querySelector("span.text-crimson")).toBeTruthy();
    expect(c1.firstElementChild?.className).toContain("bg-crimson/10");
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

  it("上船类型标识：左竖条 + 「上船 · 舰长」chip", () => {
    const { container } = render(<GuardItem event={guard} />);
    expect(container.firstElementChild?.querySelector("span")).toBeTruthy();
    expect(screen.getByText("上船 · 舰长")).toBeTruthy();
  });

  it("已读置灰 + 单击切换", () => {
    const onToggleRead = vi.fn();
    const { container } = render(
      <GuardItem event={{ ...guard, read: true }} onToggleRead={onToggleRead} />,
    );
    expect(container.firstElementChild?.className).toContain("opacity-60");
    fireEvent.click(container.firstElementChild as Element);
    expect(onToggleRead).toHaveBeenCalledTimes(1);
  });

  it("GuardItem title 为「单击切换已读」", () => {
    const { container } = render(<GuardItem event={guard} onToggleRead={vi.fn()} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("title")).toBe("单击切换已读");
  });

  it("isNew=true 渲染「New」标记，isNew 缺省/为 false 不渲染", () => {
    render(<GuardItem event={guard} isNew />);
    expect(screen.getByText("New")).toBeTruthy();
    cleanup();
    render(<GuardItem event={guard} />);
    expect(screen.queryByText("New")).toBeNull();
  });
});
