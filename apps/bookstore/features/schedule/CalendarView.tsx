"use client";

import { useMemo, useState } from "react";
import type { StreamPlan } from "@/features/schedule/api";
import { WEEKDAYS, monthGrid, shiftMonth, toDateStr } from "@/features/schedule/dateUtils";

interface CalendarViewProps {
  /** 当前展示区间的直播计划 */
  plans: StreamPlan[];
  /** 翻月回调，父组件按新月份拉取数据 */
  onMonthChange?: (from: string, to: string) => void;
}

/** 当天 YYYY-MM-DD（本地日期，规避时区）。 */
function todayStr(): string {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * 可复用月视图日历（周一开头，MON–SUN）。有计划日期展示主题；
 * 过去（已播出）弱化、未来（待播出）高亮、今天描边；同日多场全部展示。
 */
export default function CalendarView({ plans, onMonthChange }: CalendarViewProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const today = todayStr();

  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const plansByDate = useMemo(() => {
    const map = new Map<string, StreamPlan[]>();
    for (const p of plans) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return map;
  }, [plans]);

  function goMonth(delta: number) {
    const next = shiftMonth(view.y, view.m, delta);
    setView(next);
    const range = monthGrid(next.y, next.m);
    const first = range.find((c) => c.inMonth)!;
    const last = [...range].reverse().find((c) => c.inMonth)!;
    onMonthChange?.(first.dateStr, last.dateStr);
  }

  return (
    <div className="w-full select-none">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
          aria-label="上一月"
        >
          ←
        </button>
        <h2 className="font-serif text-lg font-semibold text-ink">
          {view.y} 年 {view.m} 月
        </h2>
        <button
          type="button"
          onClick={() => goMonth(1)}
          className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
          aria-label="下一月"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center font-display text-xs tracking-widest text-ink-dim"
          >
            周{w}
          </div>
        ))}

        {cells.map((cell) => {
          const cellPlans = plansByDate.get(cell.dateStr) ?? [];
          const isToday = cell.dateStr === today;
          const isPast = cell.dateStr < today;
          return (
            <div
              key={cell.dateStr}
              data-date={cell.dateStr}
              data-testid="calendar-day"
              className={`flex min-h-16 flex-col rounded-md border p-1.5 transition-colors ${
                isToday
                  ? "border-flower"
                  : "border-vine/40"
              } ${!cell.inMonth ? "opacity-40" : ""} ${
                isToday ? "" : isPast ? "bg-night" : "bg-raised"
              }`}
            >
              <span
                className={`mb-0.5 font-display text-xs ${
                  isToday ? "font-bold text-flower" : isPast ? "text-ink-dim" : "text-ink"
                }`}
              >
                {cell.d}
              </span>
              <div className="flex flex-col gap-0.5">
                {cellPlans.map((p) => (
                  <span
                    key={p.id}
                    data-testid="plan-title"
                    className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
                      isPast
                        ? "text-ink-dim/80 line-through decoration-1"
                        : "bg-soft text-ink"
                    }`}
                  >
                    {p.title}
                  </span>
                ))}
                {cellPlans.length === 0 && cell.inMonth && (
                  <span className="text-[11px] text-ink-dim/50">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
