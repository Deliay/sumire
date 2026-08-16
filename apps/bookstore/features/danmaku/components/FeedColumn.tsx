"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LiveEvent } from "../types";
import type { ReadAllType } from "../api";
import { useAnchoredFeed } from "../useAnchoredFeed";
import DanmakuItem from "./DanmakuItem";
import SuperChatItem from "./SuperChatItem";
import GiftItem from "./GiftItem";
import GuardItem from "./GuardItem";

const READ_ALL_LABELS: Record<ReadAllType, string> = {
  super_chat: "SC 全部已读",
  guard_buy: "上船 全部已读",
};

/** 「标记全部已读」二次确认超时（ms），超时未确认自动复位。 */
const CONFIRM_TIMEOUT_MS = 3000;

interface FeedColumnProps {
  title: string;
  events: LiveEvent[];
  loading?: boolean;
  canManage: boolean;
  onToggleRead?: (event: LiveEvent) => void;
  /** 本栏包含的「全部已读」管理类型（super_chat / guard_buy），仅 canManage 时渲染按钮。 */
  readAllTypes?: ReadAllType[];
  onReadAll?: (type: ReadAllType) => void;
  /** 栏头附加操作区（栏位配置按钮）。 */
  headerExtra?: ReactNode;
  /** 栏位配置面板（展开时渲染于栏头下方）。 */
  configPanel?: ReactNode;
}

/**
 * 虚拟化信息流栏容器（提案 K4/K6）：@tanstack/react-virtual 动态测高，
 * prepend 锚定 + 回到顶部；SC/上船列提供带二次确认的「标记全部已读」。
 */
export default function FeedColumn({
  title,
  events,
  loading = false,
  canManage,
  onToggleRead,
  readAllTypes = [],
  onReadAll,
  headerExtra,
  configPanel,
}: FeedColumnProps) {
  const { containerRef, showBackToTop, handleScroll, scrollToTop } = useAnchoredFeed();
  const [confirming, setConfirming] = useState<ReadAllType | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 72,
    overscan: 8,
    // eventId 作为测量 key：prepend 后测量跟随条目而非下标
    getItemKey: (index) => events[index]?.eventId ?? index,
    // jsdom / 首帧无测量时的初始视口估计（随后由浏览器实测覆盖）
    initialRect: { width: 360, height: 600 },
  });

  function handleReadAllClick(type: ReadAllType) {
    if (confirming === type) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(null);
      onReadAll?.(type);
      return;
    }
    setConfirming(type);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
  }

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
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-vine/50 bg-raised">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-vine/50 px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          {canManage &&
            readAllTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleReadAllClick(type)}
                className={`rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
                  confirming === type
                    ? "border-flower text-flower"
                    : "border-vine/50 text-ink-dim hover:border-flower hover:text-ink"
                }`}
              >
                {confirming === type ? "确认全部已读？" : READ_ALL_LABELS[type]}
              </button>
            ))}
          {headerExtra}
        </div>
      </header>
      {configPanel}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto"
          aria-label={`${title}信息流`}
        >
          {loading && events.length === 0 ? (
            <div className="m-3 min-h-32 animate-pulse rounded-md border border-vine/50 bg-soft" aria-busy="true" />
          ) : events.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-dim">暂无事件</p>
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
    </section>
  );
}
