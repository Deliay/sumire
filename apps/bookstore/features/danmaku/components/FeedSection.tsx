"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { LiveEvent } from "../types";
import { useAnchoredFeed } from "../useAnchoredFeed";
import DanmakuItem from "./DanmakuItem";
import SuperChatItem from "./SuperChatItem";
import GiftItem from "./GiftItem";
import GuardItem from "./GuardItem";

interface FeedSectionProps {
  /** 分栏内小节标题（多类型上下分栏时展示；单类型整栏不展示标签）。 */
  label?: string;
  events: LiveEvent[];
  canManage: boolean;
  onToggleRead?: (event: LiveEvent) => void;
  /** 空态文案（默认「暂无事件」）。 */
  emptyText?: string;
}

/**
 * 单类型虚拟化信息流小节（提案 K4 复用）：独立滚动容器 + prepend 锚定 + 回到顶部。
 * 供 FeedColumn 在多类型栏位上下分栏时逐类型渲染；单类型栏位整栏仅一个小节。
 */
export default function FeedSection({
  label,
  events,
  canManage,
  onToggleRead,
  emptyText = "暂无事件",
}: FeedSectionProps) {
  const { containerRef, showBackToTop, handleScroll, scrollToTop } = useAnchoredFeed();

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => events[index]?.eventId ?? index,
    initialRect: { width: 360, height: 600 },
  });

  function renderItem(event: LiveEvent) {
    const toggleRead = canManage ? onToggleRead : undefined;
    switch (event.type) {
      case "danmaku":
        return <DanmakuItem event={event} />;
      case "super_chat":
        return <SuperChatItem event={event} onToggleRead={toggleRead} />;
      case "gift":
        return <GiftItem event={event} />;
      case "guard_buy":
        return <GuardItem event={event} onToggleRead={toggleRead} />;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {label && (
        <div className="border-b border-vine/30 px-3 py-1.5 text-xs font-medium text-ink-dim">
          {label}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto"
          aria-label={label ? `${label}信息流` : undefined}
        >
          {events.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-dim">{emptyText}</p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const event = events[virtualItem.index];
                if (!event) return null;
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full border-b border-vine/30"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    {renderItem(event)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {showBackToTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute right-3 bottom-3 rounded-md border border-vine/50 bg-soft px-3 py-1.5 text-xs text-ink shadow-lg transition-colors duration-150 hover:border-flower"
          >
            回到顶部
          </button>
        )}
      </div>
    </div>
  );
}
