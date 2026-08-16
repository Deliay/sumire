"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LiveEvent, LiveEventType } from "../types";
import type { ReadAllType } from "../api";
import FeedSection from "./FeedSection";

const READ_ALL_LABELS: Record<ReadAllType, string> = {
  super_chat: "SC 全部已读",
  guard_buy: "上船 全部已读",
};

/** 「标记全部已读」二次确认超时（ms），超时未确认自动复位。 */
const CONFIRM_TIMEOUT_MS = 3000;

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
 * 多类型栏位（如默认弹幕+礼物）按类型上下分栏渲染为多个独立信息流小节。
 */
export default function FeedColumn({
  title,
  sections,
  canManage,
  onToggleRead,
  readAllTypes = [],
  onReadAll,
  headerExtra,
  configPanel,
}: FeedColumnProps) {
  const [confirming, setConfirming] = useState<ReadAllType | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const hasLabel = sections.length > 1;  function handleReadAllClick(type: ReadAllType) {
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
      <div className="flex min-h-0 flex-1 flex-col">
        {sections.map((section) => (
          <FeedSection
            key={section.type}
            label={hasLabel ? section.label : undefined}
            events={section.events}
            canManage={canManage}
            onToggleRead={onToggleRead}
            loading={section.loading}
            error={section.error}
            onRetry={section.onRetry}
            onLoadMore={section.onLoadMore}
            hasMore={section.hasMore}
            loadingMore={section.loadingMore}
          />
        ))}
      </div>
    </section>
  );
}
