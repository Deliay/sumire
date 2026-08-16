// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import FeedSection from "@/features/danmaku/components/FeedSection";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", face: null, medal: null };

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
