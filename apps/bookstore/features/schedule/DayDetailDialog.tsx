"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { StreamPlan } from "@/features/schedule/api";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";
import { parseDateStr } from "@/features/schedule/dateUtils";
import { planTimeSlot, formatPlanLabel } from "@/features/schedule/timeType";

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
  /** 当日条目（计划 + 历史直播，时间升序由组件内保证） */
  entries: CalendarEntry[];
  /** 只读模式（公开站 / member 降级） */
  readOnly: boolean;
  onClose: () => void;
  /** 管理态：底部「增加计划」（日期预填所选日） */
  onAdd?: () => void;
  onEdit?: (plan: StreamPlan) => void;
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}

/** 当日详细安排弹层：只读 / 管理双模式；历史记录只读（实际播出标签、无编辑/删除）。 */
export default function DayDetailDialog({
  open,
  date,
  entries,
  readOnly,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
}: DayDetailDialogProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // 打开时锁定背景滚动（与 Lightbox 一致，供全站弹层屏蔽整页翻页）
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sorted = [...entries].sort((a, b) => {
    // 历史条目视同 fixed 秩
    const aRank = a.kind === "plan" ? (a.plan.timeType === "allDay" ? 0 : a.plan.timeType === "fixed" ? 1 : 2) : 1;
    const bRank = b.kind === "plan" ? (b.plan.timeType === "allDay" ? 0 : b.plan.timeType === "fixed" ? 1 : 2) : 1;
    if (aRank !== bRank) return aRank - bRank;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });

  function handleClose() {
    setConfirmId(null);
    onClose();
  }

  // readOnly 模式用 paper 色系（浅底深字），管理模式用 raised 色系（深底浅字）
  const textMain = readOnly ? "text-ink-on-paper" : "text-ink";
  const textSub = readOnly ? "text-ink-on-paper/70" : "text-ink/70";
  const textDim = readOnly ? "text-ink-on-paper/60" : "text-ink-dim";
  const divider = readOnly ? "border-ink-on-paper/10" : "border-vine/30";
  const emptyText = readOnly ? "text-ink-on-paper/50" : "text-ink-dim";
  const tagCls = readOnly ? "border-ink-on-paper/30 text-ink-on-paper/60" : "border-vine/40 text-ink-dim";

  const body = (
    <>
      {sorted.length === 0 ? (
        <p className={`py-6 text-center text-sm italic ${emptyText}`}>
          这一天书屋静悄悄的。
        </p>
      ) : (
        <ul className="flex flex-col">
          {sorted.map((e) => {
            if (e.kind === "history") {
              const key = `h-${e.record.startDate}-${e.record.title}`;
              return (
                <li
                  key={key}
                  data-testid="history-row"
                  className={`flex items-center gap-3 border-b ${divider} py-3 last:border-b-0`}
                >
                  <span className={`w-12 shrink-0 text-right font-display text-sm tabular-nums ${textSub}`}>
                    {e.startTime}
                  </span>
                  <span className={`flex-1 text-sm ${textDim}`}>{e.record.title}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs ${tagCls}`}>
                    实际播出
                  </span>
                  {e.endTime && (
                    <span className={`shrink-0 text-xs tabular-nums ${textDim}`}>至 {e.endTime}</span>
                  )}
                </li>
              );
            }

            const p = e.plan;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 border-b ${divider} py-3 last:border-b-0`}
              >
                <span className={`w-12 shrink-0 text-right font-display text-sm tabular-nums ${textSub}`}>
                  {planTimeSlot(p)}
                </span>
                <span className={`flex-1 text-sm ${textMain}`}>{p.title}</span>
                {!readOnly && onEdit && onDelete && (
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className={`text-xs ${textDim} transition-colors hover:${textMain}`}
                      aria-label={`编辑 ${p.title}`}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(p.id)}
                      className={`text-xs ${textDim} transition-colors hover:text-flower`}
                      aria-label={`删除 ${p.title}`}
                    >
                      删除
                    </button>
                  </span>
                )}
                {!readOnly && confirmId === p.id && (
                  <span className="flex shrink-0 items-center gap-2 rounded bg-soft px-2 py-1">
                    <span className={`text-xs ${textMain}`}>确认删除 {formatPlanLabel(p)}？</span>
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
                      className={`text-xs ${textDim}`}
                      aria-label="取消删除"
                    >
                      取消
                    </button>
                  </span>
                )}
              </li>
            );
          })}
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
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-detail-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {/* 公开站当日详情：悬浮面板形态，不整屏变灰/毛玻璃，保留可点击外部关闭 */}
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
      </div>,
      document.body,
    );
  }

  return createPortal(
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
    </div>,
    document.body,
  );
}
