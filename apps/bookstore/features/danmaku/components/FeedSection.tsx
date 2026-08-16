"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LiveEvent, LiveEventType } from "../types";
import { mergeDanmaku, type MergedDanmaku } from "../merge";
import { useAnchoredFeed } from "../useAnchoredFeed";
import DanmakuItem from "./DanmakuItem";
import SuperChatItem from "./SuperChatItem";
import GiftItem from "./GiftItem";
import GuardItem from "./GuardItem";

/** 滚动接近容器底部（px）时触发滚动加载。 */
const LOAD_MORE_OFFSET_PX = 200;

interface FeedSectionProps {
  /** 分栏内小节标题（多类型上下分栏时展示；单类型整栏不展示标签）。 */
  label?: string;
  events: LiveEvent[];
  canManage: boolean;
  onToggleRead?: (event: LiveEvent) => void;
  /** 实时流到达的 SC/上船 eventId → type 映射，用于「New」标记。 */
  newIds?: ReadonlyMap<string, LiveEventType>;
  /** 空态文案（默认「暂无事件」）。 */
  emptyText?: string;
  /** 本小节历史加载中（无事件时展示骨架）。 */
  loading?: boolean;
  /** 本小节历史检索错误提示（非空时展示错误态替代空态/列表）。 */
  error?: string | null;
  /** 错误态重试回调。 */
  onRetry?: () => void;
  /** 滚动接近尾部时触发（加载下一页历史）。 */
  onLoadMore?: () => void;
  /** 是否有更多历史可加载（events.length < 服务端 total）。 */
  hasMore?: boolean;
  /** 加载更多中（尾部展示加载提示）。 */
  loadingMore?: boolean;
}

/**
 * 单类型虚拟化信息流小节（提案 K4 复用）：独立滚动容器 + prepend 锚定 + 回到顶部。
 * 供 FeedColumn 在多类型栏位上下分栏时逐类型渲染；单类型栏位整栏仅一个小节。
 * 滚动接近尾部时触发 `onLoadMore` 分页加载历史（count 随 SSE/分页动态增长）。
 */
export default function FeedSection({
  label,
  events,
  canManage,
  onToggleRead,
  newIds = new Map(),
  emptyText = "暂无事件",
  loading = false,
  error = null,
  onRetry,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: FeedSectionProps) {
  const { containerRef, showBackToTop, handleScroll, scrollToTop } = useAnchoredFeed();

  // 相邻重复弹幕折叠为一行（展示计数）；非弹幕原样透传。
  const rows = useMemo<MergedDanmaku[]>(() => mergeDanmaku(events), [events]);
  // 折叠使可视行减少（rows.length < events.length）
  const folded = rows.length < events.length;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => rows[index]?.event.eventId ?? index,
    initialRect: { width: 360, height: 600 },
  });

  // 滚动接近容器底部时触发下一页历史加载；加载中/无更多/空列表时不触发。
  // 仅当容器可滚动（scrollHeight > clientHeight）且贴近底部时自动加载：
  // 短列表（未铺满）不自动加载，避免多类型栏位中小节数量少而 hasMore 由整栏驱动导致的无限加载，
  // 短列表改用尾部「加载更多」按钮手动加载。
  // 例外：弹幕折叠使可视行减少（folded）且列表未铺满时，向下加载一条填充视口。
  const maybeLoadMore = useCallback(() => {
    if (!onLoadMore || loadingMore) return;
    const el = containerRef.current;
    if (!el || !hasMore || events.length === 0) return;
    if (folded && el.scrollHeight <= el.clientHeight) {
      onLoadMore();
      return;
    }
    if (el.scrollHeight <= el.clientHeight) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_MORE_OFFSET_PX) {
      onLoadMore();
    }
  }, [onLoadMore, loadingMore, hasMore, events.length, containerRef, folded]);

  // 加载更多后容器可能仍未铺满，继续探测；事件数量变化（SSE prepend / 分页 append）时重新评估
  useEffect(() => {
    maybeLoadMore();
  }, [maybeLoadMore, events.length]);

  function renderItem(row: MergedDanmaku) {
    const event = row.event;
    const toggleRead = canManage ? onToggleRead : undefined;
    const isNew = newIds.has(event.eventId);
    switch (event.type) {
      case "danmaku":
        return <DanmakuItem event={event} count={row.count} />;
      case "super_chat":
        return <SuperChatItem event={event} isNew={isNew} onToggleRead={toggleRead} />;
      case "gift":
        return <GiftItem event={event} />;
      case "guard_buy":
        return <GuardItem event={event} isNew={isNew} onToggleRead={toggleRead} />;
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
          onScroll={(e) => {
            handleScroll();
            maybeLoadMore();
            void e;
          }}
          className="min-h-0 flex-1 overflow-y-auto"
          aria-label={label ? `${label}信息流` : undefined}
        >
          {loading && events.length === 0 ? (
            <div className="m-3 min-h-32 animate-pulse rounded-md border border-vine/50 bg-soft" aria-busy="true" />
          ) : error ? (
            <div className="m-3 flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-flower/60 bg-soft px-3 py-6 text-center">
              <p className="text-sm text-ink-dim">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-md border border-vine/50 px-2 py-1 text-xs text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
                >
                  重试
                </button>
              )}
            </div>
          ) : events.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-dim">{emptyText}</p>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const row = rows[virtualItem.index];
                if (!row) return null;
                return (
                  <div
                    key={virtualItem.key}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full border-b border-vine/30"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    {renderItem(row)}
                  </div>
                );
              })}
            </div>
          )}
          {loadingMore && events.length > 0 && (
            <p className="px-3 py-3 text-center text-xs text-ink-dim" aria-busy="true">
              加载中…
            </p>
          )}
          {!loadingMore && hasMore && events.length > 0 && (
            <button
              type="button"
              onClick={onLoadMore}
              className="w-full py-3 text-center text-xs text-ink-dim transition-colors duration-150 hover:text-ink"
            >
              加载更多
            </button>
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
