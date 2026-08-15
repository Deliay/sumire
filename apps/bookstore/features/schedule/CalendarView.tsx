"use client";

import { useMemo, useState } from "react";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";
import { WEEKDAYS, monthGrid, shiftMonth, toDateStr } from "@/features/schedule/dateUtils";

const MAX_SUMMARIES = 2;

interface CalendarViewProps {
  /** 当前展示区间的日历条目（计划 + 历史直播，已归一化合并） */
  entries: CalendarEntry[];
  /** 翻月回调，父组件按新月份拉取数据 */
  onMonthChange?: (from: string, to: string) => void;
  /** 点击某天回调，上抛所选日期 YYYY-MM-DD */
  onSelectDay?: (date: string) => void;
}

function entryTitle(entry: CalendarEntry): string {
  return entry.kind === "plan" ? entry.plan.title : entry.record.title;
}

/** 当天 YYYY-MM-DD（本地日期，规避时区）。 */
function todayStr(): string {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * 可复用月视图日历（周一开头，MON–SUN）。有计划/历史条目日期展示至多 2 条
 * 「HH:mm 主题」摘要（更多以 +N 收尾）；过去（已播出）弱化、未来（待播出）高亮、
 * 今天藤蔓描边；历史记录恒为「已播出」弱化样式并以藤蔓点标记区分来源；点击某天上抛日期。
 */
export default function CalendarView({ entries, onMonthChange, onSelectDay }: CalendarViewProps) {
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const today = todayStr();

  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [entries]);

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
          ← 上月
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
          下月 →
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
          const cellEntries = entriesByDate.get(cell.dateStr) ?? [];
          const isToday = cell.dateStr === today;
          const isPast = cell.dateStr < today;
          const shown = cellEntries.slice(0, MAX_SUMMARIES);
          const extra = cellEntries.length - MAX_SUMMARIES;
          const clickable = cell.inMonth && onSelectDay;
          return (
            <button
              type="button"
              key={cell.dateStr}
              data-date={cell.dateStr}
              data-testid="calendar-day"
              onClick={() => clickable && onSelectDay(cell.dateStr)}
              aria-label={cell.inMonth ? `查看 ${cell.dateStr} 安排` : undefined}
              className={`relative flex min-h-16 flex-col rounded-md border p-1.5 text-left transition-colors ${
                isToday ? "border-flower" : "border-vine/40"
              } ${!cell.inMonth ? "opacity-35" : ""} ${
                isToday ? "" : isPast ? "bg-night opacity-60" : "bg-raised hover:border-flower"
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {isToday && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-flower"
                />
              )}
              <span
                className={`mb-0.5 pl-2 font-display text-xs ${
                  isToday ? "font-bold text-flower" : isPast ? "text-ink-dim" : "text-ink"
                }`}
              >
                {cell.d}
              </span>
              <div className="flex flex-col gap-0.5">
                {shown.map((e) => {
                  const isHistory = e.kind === "history";
                  return (
                    <span
                      key={isHistory ? `h-${e.record.startDate}-${e.record.title}` : e.plan.id}
                      data-testid={isHistory ? "history-title" : "plan-title"}
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
                        isHistory || isPast ? "text-ink-dim/80" : "bg-soft text-ink"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mr-0.5 inline-block h-1 w-1 rounded-full align-middle ${
                          isHistory ? "bg-vine" : "bg-eye"
                        }`}
                      />
                      <span className="tabular-nums">{e.startTime}</span> {entryTitle(e)}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="text-[11px] tabular-nums text-ink-dim">+{extra}</span>
                )}
                {cellEntries.length === 0 && cell.inMonth && (
                  <span className="text-[11px] text-ink-dim/50">—</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
