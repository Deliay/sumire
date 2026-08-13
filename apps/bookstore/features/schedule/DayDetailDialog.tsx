"use client";

import { useState } from "react";
import type { StreamPlan } from "@/features/schedule/api";
import { parseDateStr } from "@/features/schedule/dateUtils";

const WEEKDAY_LABEL = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 「8 月 15 日 · 周六」标题文案。 */
export function dayTitle(date: string): string {
  const p = parseDateStr(date);
  if (!p) return date;
  const wd = new Date(p.y, p.m - 1, p.d).getDay();
  return `${p.m} 月 ${p.d} 日 · 周${WEEKDAY_LABEL[wd]}`;
}

interface DayDetailDialogProps {
  open: boolean;
  /** 所选日 YYYY-MM-DD */
  date: string;
  /** 当日直播计划（时间升序由组件内保证） */
  plans: StreamPlan[];
  /** 只读模式（公开站 / member 降级） */
  readOnly: boolean;
  onClose: () => void;
  /** 管理态：底部「增加计划」（日期预填所选日） */
  onAdd?: () => void;
  onEdit?: (plan: StreamPlan) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}

/** 当日详细安排弹层：只读 / 管理双模式。 */
export default function DayDetailDialog({
  open,
  date,
  plans,
  readOnly,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
}: DayDetailDialogProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!open) return null;

  const sorted = [...plans].sort((a, b) => a.startTime.localeCompare(b.startTime));

  function handleClose() {
    setConfirmId(null);
    onClose();
  }

  const body = (
    <>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm italic text-ink-on-paper/50">
          这一天书屋静悄悄的。
        </p>
      ) : (
        <ul className="flex flex-col">
          {sorted.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 border-b border-ink-on-paper/10 py-3 last:border-b-0"
            >
              <span className="w-12 shrink-0 text-right font-display text-sm tabular-nums text-ink-on-paper/70">
                {p.startTime}
              </span>
              <span className="flex-1 text-sm text-ink-on-paper">{p.title}</span>
              {!readOnly && onEdit && onDelete && (
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-xs text-ink-on-paper/60 transition-colors hover:text-ink-on-paper"
                    aria-label={`编辑 ${p.title}`}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(p.id)}
                    className="text-xs text-ink-on-paper/60 transition-colors hover:text-flower"
                    aria-label={`删除 ${p.title}`}
                  >
                    删除
                  </button>
                </span>
              )}
              {!readOnly && confirmId === p.id && (
                <span className="flex shrink-0 items-center gap-2 rounded bg-soft px-2 py-1">
                  <span className="text-xs text-ink">确认删除 {p.startTime} {p.title}？</span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmId(null);
                      onDelete?.(p.id);
                    }}
                    disabled={deletingId === p.id}
                    className="text-xs font-medium text-flower disabled:opacity-50"
                    aria-label="确认删除"
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-xs text-ink-dim"
                    aria-label="取消删除"
                  >
                    取消
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && onAdd && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onAdd}
            className="w-full rounded-md border border-primary/60 px-4 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
          >
            + 增加计划
          </button>
        </div>
      )}
    </>
  );

  if (readOnly) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <div className="w-full max-w-md rounded-xl border border-vine/50 bg-paper p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 id="day-detail-title" className="font-serif text-xl font-semibold text-ink-on-paper">
              {dayTitle(date)}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-ink-on-paper/60 transition-colors hover:text-ink-on-paper"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
          <div className="mt-4">{body}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-vine/50 bg-raised p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="day-detail-title" className="font-serif text-xl font-semibold text-ink">
            {dayTitle(date)}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-ink-dim transition-colors hover:text-ink"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{body}</div>
      </div>
    </div>
  );
}
