"use client";

import type { ReactNode } from "react";
import type { RefObject } from "react";
import type { HoverPill } from "../hoverTopBar";
import type { LiveEvent, LiveEventType } from "../types";
import FeedSection from "./FeedSection";
import type { FeedSectionHandle } from "./FeedSection";
import HoverTopBar from "./HoverTopBar";

/** 栏内小节：单类型数据 + 其标题。 */
export interface FeedSectionData {
  type: LiveEventType;
  label: string;
  events: LiveEvent[];
  /** 本小节历史加载中（无事件时展示骨架）。 */
  loading?: boolean;
  /** 本小节历史检索错误提示。 */
  error?: string | null;
  /** 错误态重试回调。 */
  onRetry?: () => void;
  /** 滚动接近小节尾部时触发（加载下一页历史）。 */
  onLoadMore?: () => void;
  /** 本小节是否还有更多历史可加载。 */
  hasMore?: boolean;
  /** 本小节加载更多中。 */
  loadingMore?: boolean;
}

interface FeedColumnProps {
  title: string;
  /** 栏内小节（按类型分组）：单类型整栏仅一个小节；多类型栏位上下分栏逐小节渲染。 */
  sections: FeedSectionData[];
  canManage: boolean;
  onToggleRead?: (event: LiveEvent) => void;
  /** 实时流到达的 SC/上船 eventId → type 映射，用于「New」标记。 */
  newIds?: ReadonlyMap<string, LiveEventType>;
  /** 弹幕合并开关（透传各小节；默认 false 逐条渲染）。 */
  mergeEnabled?: boolean;
  /** SSE 实时插入的事件 id 集合（透传各小节，命中行挂入场动画）。 */
  freshIds?: ReadonlySet<string>;
  /** 栏头附加操作区（栏位配置按钮）。 */
  headerExtra?: ReactNode;
  /** 栏位配置面板（展开时渲染于栏头下方）。 */
  configPanel?: ReactNode;
  /** 悬停胶囊列表（SC/上船事件）。 */
  hoverPills?: HoverPill[];
  /** 点击胶囊定位到对应事件。 */
  onLocate?: (eventId: string) => void;
  /** 各小节 FeedSection 的 ref 映射（key = `${colId}:${type}`），用于外部定位调用。 */
  sectionRefs?: ReadonlyMap<string, RefObject<FeedSectionHandle | null>>;
}

/**
 * 虚拟化信息流栏容器（提案 K4/K6）：@tanstack/react-virtual 动态测高，
 * prepend 锚定 + 回到顶部。
 * 多类型栏位（如默认弹幕+礼物）按类型上下分栏渲染为多个独立信息流小节。
 */
export default function FeedColumn({
  title,
  sections,
  canManage,
  onToggleRead,
  newIds = new Map(),
  mergeEnabled = false,
  freshIds = new Set(),
  headerExtra,
  configPanel,
  hoverPills,
  onLocate,
  sectionRefs,
}: FeedColumnProps) {
  const hasLabel = sections.length > 1;

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-vine/50 bg-raised">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-vine/50 px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-2">
          {headerExtra}
        </div>
      </header>
      {configPanel}
      {hoverPills && onLocate && <HoverTopBar pills={hoverPills} onLocate={onLocate} />}
      <div className="flex min-h-0 flex-1 flex-col">
        {sections.map((section) => {
          const sectionKey = section.type;
          return (
            <FeedSection
              key={sectionKey}
              ref={sectionRefs?.get(sectionKey)}
              label={hasLabel ? section.label : undefined}
              events={section.events}
              canManage={canManage}
              onToggleRead={onToggleRead}
              newIds={newIds}
              mergeEnabled={mergeEnabled}
              freshIds={freshIds}
              loading={section.loading}
              error={section.error}
              onRetry={section.onRetry}
              onLoadMore={section.onLoadMore}
              hasMore={section.hasMore}
              loadingMore={section.loadingMore}
            />
          );
        })}
      </div>
    </section>
  );
}
