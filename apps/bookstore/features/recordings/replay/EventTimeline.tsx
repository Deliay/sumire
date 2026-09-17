"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LiveEvent } from "@/features/danmaku/types";
import DanmakuItem from "@/features/danmaku/components/DanmakuItem";
import SuperChatItem from "@/features/danmaku/components/SuperChatItem";
import GiftItem from "@/features/danmaku/components/GiftItem";
import GuardItem from "@/features/danmaku/components/GuardItem";

interface EventTimelineProps {
  events: LiveEvent[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  /** 当前播放时间（秒），驱动自动跟随与高亮。 */
  currentTime: number;
  /** 分段实际起点毫秒（info.startedAt 推导，info 缺失回退 createdAt）；null 时禁用偏移映射与跟随。 */
  recordStartMs: number | null;
  /** 点击条目：跳转到相对录播的偏移秒（走既有 seek 路径）。 */
  onSeek: (offsetSeconds: number) => void;
}

interface TimelineEntry {
  event: LiveEvent;
  offsetSeconds: number;
}

/** 单行估算高度（px）；实际高度经 virtualizer.measureElement 动态测量修正。 */
const ESTIMATED_ROW_HEIGHT = 72;

function renderItem(event: LiveEvent) {
  switch (event.type) {
    case "super_chat":
      return <SuperChatItem event={event} />;
    case "gift":
      return <GiftItem event={event} />;
    case "guard_buy":
      return <GuardItem event={event} />;
    case "danmaku":
    default:
      return <DanmakuItem event={event} />;
  }
}

/**
 * 回放事件列表：升序渲染四类事件、随播放进度自动跟随/高亮、点击跳转；无已读语义。
 * 采用 `@tanstack/react-virtual` 虚拟化（仅渲染可视区条目，长录播累积数千条仍流畅），
 * 跟随定位走 `scrollToIndex`（`scrollIntoView` 对未挂载条目无效），行高经 `measureElement` 动态测量。
 */
export default function EventTimeline({
  events,
  loading,
  error,
  onRetry,
  currentTime,
  recordStartMs,
  onSeek,
}: EventTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);

  const entries = useMemo<TimelineEntry[]>(() => {
    if (recordStartMs === null) return [];
    const mapped: TimelineEntry[] = [];
    for (const event of events) {
      const ms = Date.parse(event.occurredAt) - recordStartMs;
      if (!Number.isFinite(ms)) continue;
      mapped.push({ event, offsetSeconds: ms / 1000 });
    }
    mapped.sort((a, b) => a.offsetSeconds - b.offsetSeconds);
    return mapped;
  }, [events, recordStartMs]);

  // 当前事件 = 首个 offset ≥ currentTime（列表已升序）
  const currentIndex = useMemo(() => {
    if (recordStartMs === null) return -1;
    return entries.findIndex((entry) => entry.offsetSeconds >= currentTime);
  }, [entries, currentTime, recordStartMs]);

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual 返回的函数不可被 React Compiler 安全记忆化
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => entries[index]?.event.eventId ?? index,
    initialRect: { width: 360, height: 600 },
  });

  const scrollToCurrent = useCallback(() => {
    if (currentIndex < 0) return;
    virtualizer.scrollToIndex(currentIndex, { align: "auto" });
  }, [currentIndex, virtualizer]);

  useEffect(() => {
    if (!following || currentIndex < 0) return;
    scrollToCurrent();
  }, [following, currentIndex, scrollToCurrent]);

  const pauseFollowing = () => setFollowing(false);
  const resumeFollowing = () => {
    setFollowing(true);
    scrollToCurrent();
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <section aria-label="事件列表" className="flex min-h-0 flex-col gap-2">
      {!following && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resumeFollowing}
            className="rounded-full border border-flower px-3 py-1 text-tiny text-flower transition-colors hover:bg-flower/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
          >
            回到当前进度
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        data-testid="event-timeline-scroll"
        onWheel={pauseFollowing}
        onTouchMove={pauseFollowing}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-vine/50 bg-raised/60"
      >
        {error && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-small text-ink-dim">
            <p>弹幕事件加载失败。</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-vine px-3 py-1 text-tiny transition-colors hover:border-flower hover:text-ink"
            >
              重试
            </button>
          </div>
        )}

        {!error && loading && entries.length === 0 && (
          <p className="px-4 py-10 text-center text-small text-ink-dim">正在加载弹幕事件…</p>
        )}

        {!error && !loading && entries.length === 0 && (
          <p className="px-4 py-10 text-center text-small text-ink-dim">本场直播暂无弹幕事件</p>
        )}

        {!error && entries.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualItems.map((virtualItem) => {
              const entry = entries[virtualItem.index];
              if (!entry) return null;
              const isCurrent = virtualItem.index === currentIndex;
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  data-timeline-event={entry.event.eventId}
                  data-current={isCurrent ? "true" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label="跳转到该事件时间点"
                  onClick={() => onSeek(entry.offsetSeconds)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSeek(entry.offsetSeconds);
                    }
                  }}
                  className={`absolute top-0 left-0 w-full cursor-pointer border-b border-vine/20 transition-colors hover:bg-soft/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower ${
                    isCurrent ? "bg-flower/10 ring-1 ring-flower" : ""
                  }`}
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  {renderItem(entry.event)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}