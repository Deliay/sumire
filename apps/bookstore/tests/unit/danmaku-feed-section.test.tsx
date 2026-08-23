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

  it("mergeEnabled 缺省（默认关闭）时重复弹幕逐条渲染，无「×N」计数", () => {
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:a", type: "danmaku", content: "妈妈妈妈妈" }),
      makeEvent({ eventId: "dm:b", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} />);
    expect(screen.queryByText(/×\d+/)).toBeNull();
    expect(screen.getByText("妈妈妈妈妈")).toBeTruthy();
    expect(screen.getByText("妈妈")).toBeTruthy();
  });

  it("mergeEnabled=false 时重复弹幕逐条渲染，无「×N」计数", () => {
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:a", type: "danmaku", content: "妈妈妈妈妈" }),
      makeEvent({ eventId: "dm:b", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} mergeEnabled={false} />);
    expect(screen.queryByText(/×\d+/)).toBeNull();
  });

  it("mergeEnabled=true：相邻重复弹幕折叠为一行并展示计数，而非重复弹幕各自展示", () => {
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:a", type: "danmaku", content: "妈妈妈妈妈" }),
      makeEvent({ eventId: "dm:b", type: "danmaku", content: "妈妈妈" }),
      makeEvent({ eventId: "dm:c", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:d", type: "danmaku", content: "欢迎欢迎" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} mergeEnabled />);
    expect(screen.getByText("×3")).toBeTruthy();
    expect(screen.queryByText("×1")).toBeNull();
  });

  it("mergeEnabled=true：非连续重复弹幕同样折叠（跨其他事件）", () => {
    const events: LiveEvent[] = [
      makeEvent({ eventId: "dm:1", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:2", type: "danmaku", content: "欢迎欢迎" }),
      makeEvent({ eventId: "dm:3", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={events} canManage={false} mergeEnabled />);
    expect(screen.getByText("×2")).toBeTruthy();
  });

  it("mergeEnabled=true：折叠使短列表未铺满时自动向下加载一条填充（hasMore）", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    const onLoadMore = vi.fn();
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:1", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:2", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} mergeEnabled onLoadMore={onLoadMore} hasMore />);
    await act(async () => {});
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("mergeEnabled=false：重复弹幕不折叠（folded=false），短列表不触发折叠自动填充", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(300);
    const onLoadMore = vi.fn();
    const dupes: LiveEvent[] = [
      makeEvent({ eventId: "dm:1", type: "danmaku", content: "妈妈" }),
      makeEvent({ eventId: "dm:2", type: "danmaku", content: "妈妈" }),
    ];
    render(<FeedSection label="弹幕" events={dupes} canManage={false} onLoadMore={onLoadMore} hasMore />);
    await act(async () => {});
    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "加载更多" })).toBeTruthy();
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

describe("FeedSection 插入/平移动效", () => {
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

  it("freshIds 命中的行内层带入场动画类，未命中行不带", () => {
    const { container } = render(
      <FeedSection
        label="弹幕"
        events={EVENTS.slice(0, 3)}
        canManage={false}
        freshIds={new Set(["dm:1"])}
      />,
    );
    const freshInner = container.querySelector('[data-event-id="dm:1"]')?.parentElement;
    expect(freshInner?.className).toContain("animate-danmaku-enter");
    const otherInner = container.querySelector('[data-event-id="dm:0"]')?.parentElement;
    expect(otherInner?.className ?? "").not.toContain("animate-danmaku-enter");
  });

  it("freshIds 缺省时无入场动画类", () => {
    const { container } = render(<FeedSection label="弹幕" events={EVENTS.slice(0, 3)} canManage={false} />);
    expect(container.querySelector(".animate-danmaku-enter")).toBeNull();
  });

  it("虚拟行 wrapper 静止时带 transform 平移过渡类", () => {
    const { container } = render(<FeedSection label="弹幕" events={EVENTS.slice(0, 3)} canManage={false} />);
    const wrapper = container.querySelector('[data-event-id="dm:0"]')?.parentElement?.parentElement;
    expect(wrapper?.className).toContain("transition-transform");
    expect(wrapper?.className).toContain("duration-50");
  });

  it("离顶滚动后虚拟行 wrapper 禁用平移过渡（锚定补偿瞬时接管，防补偿+过渡叠加闪回）", async () => {
    const { container } = render(<FeedSection label="弹幕" events={EVENTS.slice(0, 3)} canManage={false} />);
    const wrapper = () => container.querySelector('[data-event-id="dm:0"]')?.parentElement?.parentElement;
    expect(wrapper()?.className).toContain("transition-transform");

    const scroller = container.querySelector(".overflow-y-auto")!;
    scroller.scrollTop = 100;
    fireEvent.scroll(scroller);
    expect(wrapper()?.className).toContain("transition-none");

    // 回顶后 isAtTop 恢复，但 virtualizer.isScrolling 有滚动结束去抖延迟，待其复位后再断言
    scroller.scrollTop = 0;
    fireEvent.scroll(scroller);
    await vi.waitFor(() => {
      expect(wrapper()?.className).toContain("transition-transform");
    });
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
        label="上船+SC"
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

describe("FeedSection locate 定位 + 闪光", () => {
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

  it("locate 命中已加载目标时滚动定位并触发闪光", async () => {
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
      />,
    );
    await act(async () => {
      ref.current.locate("dm:2");
    });
    // 应该调用 scrollToIndex（通过 virtualizer）
    // 闪光：目标行内层应有 animate-danmaku-flash 类
    const targetInner = document.querySelector('[data-event-id="dm:2"]')?.parentElement;
    expect(targetInner?.className).toContain("animate-danmaku-flash");
  });

  it("locate 闪光约 1s 后自动清除", async () => {
    vi.useFakeTimers();
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
      />,
    );
    await act(async () => {
      ref.current.locate("dm:2");
    });
    const flash = () => document.querySelector('[data-event-id="dm:2"]')?.parentElement;
    expect(flash()?.className).toContain("animate-danmaku-flash");
    // 约 1s 后闪光清除
    act(() => vi.advanceTimersByTime(1100));
    expect(flash()?.className).not.toContain("animate-danmaku-flash");
    vi.useRealTimers();
  });

  it("locate 未命中时触发 onLoadMore 加载更多", async () => {
    const onLoadMore = vi.fn();
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
        onLoadMore={onLoadMore}
        hasMore
      />,
    );
    await act(async () => {
      ref.current.locate("dm:99"); // 不在已加载列表中
    });
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("locate 未命中且 hasMore=false 时不触发 onLoadMore", async () => {
    const onLoadMore = vi.fn();
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
        onLoadMore={onLoadMore}
        hasMore={false}
      />,
    );
    await act(async () => {
      ref.current.locate("dm:99");
    });
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("locate 重复定位可重新触发闪光", async () => {
    vi.useFakeTimers();
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
      />,
    );
    await act(async () => {
      ref.current.locate("dm:2");
    });
    const flash = () => document.querySelector('[data-event-id="dm:2"]')?.parentElement;
    expect(flash()?.className).toContain("animate-danmaku-flash");
    // 等待闪光清除
    act(() => vi.advanceTimersByTime(1100));
    expect(flash()?.className).not.toContain("animate-danmaku-flash");
    // 重新定位
    await act(async () => {
      ref.current.locate("dm:2");
    });
    expect(flash()?.className).toContain("animate-danmaku-flash");
    vi.useRealTimers();
  });

  it("locate 后 onScroll 不清除闪光状态（闪光由计时器控制）", async () => {
    vi.useFakeTimers();
    const ref = { current: null as unknown as import("@/features/danmaku/components/FeedSection").FeedSectionHandle };
    render(
      <FeedSection
        ref={ref}
        label="弹幕"
        events={EVENTS.slice(0, 5)}
        canManage={false}
      />,
    );
    await act(async () => {
      ref.current.locate("dm:2");
    });
    const flash = () => document.querySelector('[data-event-id="dm:2"]')?.parentElement;
    expect(flash()?.className).toContain("animate-danmaku-flash");
    // 滚动不触发闪光清除
    const scroller = document.querySelector(".overflow-y-auto")!;
    act(() => {
      scroller.scrollTop = 100;
      fireEvent.scroll(scroller);
    });
    expect(flash()?.className).toContain("animate-danmaku-flash");
    vi.useRealTimers();
  });
});
