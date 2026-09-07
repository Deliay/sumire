"use client";

import { useState, useEffect, useRef } from "react";
import MarkdownView from "@/features/markdown/MarkdownView";
import MarshmallowDetailDialog from "@/features/topics/components/MarshmallowDetailDialog";
import type { Marshmallow } from "@/features/topics/types";

interface MarshmallowCardProps {
  marshmallow: Marshmallow;
  onToggleAdopt?: (id: string, adopted: boolean) => void;
  onShowAnyway?: (id: string) => void;
}

export default function MarshmallowCard({
  marshmallow,
  onToggleAdopt,
  onShowAnyway,
}: MarshmallowCardProps) {
  const { id, content, adopted, aiReview } = marshmallow;
  // I14: "提前查看" 仅本地 state 临时展示，不持久化
  const [showPendingContent, setShowPendingContent] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const isRejected = aiReview?.status === "rejected" && !aiReview?.ignoredByAdmin;
  const isPending = aiReview?.status === "pending" && !aiReview?.ignoredByAdmin;

  // 判断内容是否超过 5 行（line-clamp-5 + overflow-hidden 下 scrollHeight > clientHeight 即超限）
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  return (
    <div
      className={`relative w-full rounded-lg border border-vine bg-raised p-4 ${
        adopted ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 relative">
          <div ref={contentRef} className="line-clamp-5 overflow-hidden">
            <MarkdownView content={content} />
          </div>
          {overflowing && (
            <button
              type="button"
              onClick={() => setShowDetail(true)}
              className="absolute inset-x-0 bottom-0 h-12 flex items-end justify-center pb-1 bg-gradient-to-t from-raised to-transparent text-sm text-primary cursor-pointer transition-colors duration-150 hover:text-primary/80"
              aria-label="点击查看全文"
            >
              点击查看全文
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {adopted && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-flower">
              已采用
            </span>
          )}
          {onToggleAdopt && (
            <button
              type="button"
              onClick={() => onToggleAdopt(id, !adopted)}
              className="text-xs text-ink-dim hover:text-ink transition-colors duration-150"
            >
              {adopted ? "取消采用" : "采用"}
            </button>
          )}
        </div>
      </div>

      {/* AI 审核覆盖层（不透明实色底，不透出底下内容） */}
      {isRejected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-night rounded-lg p-4">
          <p className="text-sm text-ink text-center mb-3">
            这个棉花糖可能会有有害内容，AI拒绝原因：{aiReview?.filteredReason}
          </p>
          {onShowAnyway && (
            <button
              type="button"
              onClick={() => onShowAnyway(id)}
              className="text-sm bg-primary text-night px-3 py-1.5 rounded hover:bg-primary/90"
            >
              显示这条棉花糖
            </button>
          )}
        </div>
      )}

      {/* I14: pending 状态显示"提前查看"按钮（不透明实色底） */}
      {isPending && !showPendingContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-night rounded-lg p-4">
          <p className="text-sm text-ink text-center mb-2">
            这条内容AI正在审核中
          </p>
          <button
            type="button"
            onClick={() => setShowPendingContent(true)}
            className="text-sm text-ink-dim hover:text-ink"
          >
            提前查看
          </button>
        </div>
      )}

      {showDetail && (
        <MarshmallowDetailDialog
          marshmallow={marshmallow}
          onToggleAdopt={onToggleAdopt}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}