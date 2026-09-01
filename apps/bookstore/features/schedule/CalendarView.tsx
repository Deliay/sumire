"use client";

import { useMemo, useRef, useState } from "react";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";
import { createDrag, feedPointer, release } from "@/features/schedule/calendarDrag";
import {
  WEEKDAYS,
  daysInMonth,
  formatWeekRange,
  monthGrid,
  monthGridRange,
  parseDateStr,
  shiftMonth,
  shiftWeek,
  toDateStr,
  weekDates,
} from "@/features/schedule/dateUtils";
import { useMediaQuery } from "@/lib/useMediaQuery";

const MONTH_MAX_SUMMARIES = 2;
const WEEK_MAX_SUMMARIES = 4;

interface CalendarViewProps {
  /** 当前展示区间的日历条目（计划 + 历史直播，已归一化合并） */
  entries: CalendarEntry[];
  /** 可见范围变更回调，父组件按新区间拉取数据（月视图传月区间，周视图传周一~周日） */
  onRangeChange?: (from: string, to: string) => void;
  /** 点击某天回调，上抛所选日期 YYYY-MM-DD */
  onSelectDay?: (date: string) => void;
  /** 变体：panel（后台默认，DOM/样式逐位保持现态）或 immersive（公开全幅直角中字 + 侧翻月竖条 + 拖拽翻月） */
  variant?: "panel" | "immersive";
}

function entryTitle(entry: CalendarEntry): string {
  return entry.kind === "plan" ? entry.plan.title : entry.record.title;
}

/** 当天 YYYY-MM-DD（本地日期，规避时区）。 */
function todayStr(): string {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

interface DaySummariesProps {
  entries: CalendarEntry[];
  isPast: boolean;
  maxSummaries: number;
  /** 空天是否渲染「—」占位（月视图补位格为 false）。 */
  showEmpty: boolean;
  /** immersive 变体放大摘要字号。 */
  immersive?: boolean;
}

/** 单日条目摘要列表（月/周两形态共用）：HH:mm 主题、+N 收口、历史来源样式、空天占位。 */
function DaySummaries({ entries, isPast, maxSummaries, showEmpty, immersive = false }: DaySummariesProps) {
  const shown = entries.slice(0, maxSummaries);
  const extra = entries.length - maxSummaries;
  const size = immersive ? "text-sm" : "text-[11px]";
  return (
    <div className="flex flex-col gap-0.5">
      {shown.map((e) => {
        const isHistory = e.kind === "history";
        return (
          <span
            key={isHistory ? `h-${e.record.startDate}-${e.record.title}` : e.plan.id}
            data-testid={isHistory ? "history-title" : "plan-title"}
            className={`truncate rounded px-1 py-0.5 leading-tight ${size} ${
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
        <span className={`tabular-nums text-ink-dim ${size}`}>+{extra}</span>
      )}
      {entries.length === 0 && showEmpty && (
        <span className={`text-ink-dim/50 ${size}`}>—</span>
      )}
    </div>
  );
}

interface DayCellProps {
  dateStr: string;
  day: number;
  inMonth: boolean;
  entries: CalendarEntry[];
  today: string;
  maxSummaries: number;
  onSelectDay?: (date: string) => void;
  variant: "panel" | "immersive";
}

/** 单日格子渲染（月视图）：日期数字、今天标记、过去弱化、条目摘要、+N 收口、历史来源样式、空天占位。 */
function DayCell({ dateStr, day, inMonth, entries, today, maxSummaries, onSelectDay, variant }: DayCellProps) {
  const isToday = dateStr === today;
  const isPast = dateStr < today;
  const clickable = inMonth && !!onSelectDay;
  const immersive = variant === "immersive";
  return (
    <button
      type="button"
      data-date={dateStr}
      data-testid="calendar-day"
      onClick={() => clickable && onSelectDay?.(dateStr)}
      aria-label={inMonth ? `查看 ${dateStr} 安排` : undefined}
      className={`relative flex h-full min-h-16 flex-col overflow-hidden border p-1.5 text-left transition-colors ${
        immersive ? "" : "rounded-md"
      } ${isToday ? "border-flower" : "border-vine/40"} ${!inMonth ? "opacity-35" : ""} ${
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
        className={`mb-0.5 pl-2 font-display ${
          immersive ? "text-base" : "text-xs"
        } ${isToday ? "font-bold text-flower" : isPast ? "text-ink-dim" : "text-ink"}`}
      >
        {day}
      </span>
      <DaySummaries entries={entries} isPast={isPast} maxSummaries={maxSummaries} showEmpty={inMonth} immersive={immersive} />
    </button>
  );
}

/**
 * 可复用响应式日历（周一开头，MON–SUN）。< 640px 渲染周视图（单周 7 天纵向列表 + 周切换 + 今天），
 * ≥ 640px 维持既有月视图。有计划/历史条目日期展示摘要（更多以 +N 收尾）；过去（已播出）弱化、
 * 未来（待播出）高亮、今天藤蔓描边；历史记录恒为「已播出」弱化样式并以藤蔓点标记区分来源；
 * 点击某天上抛日期；可见范围变更经 onRangeChange 上抛。
 */
export default function CalendarView({ entries, onRangeChange, onSelectDay, variant = "panel" }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => todayStr());
  const isWeek = useMediaQuery("(max-width: 639px)");
  const today = todayStr();
  const dragRef = useRef(createDrag());
  const lastXRef = useRef<number | null>(null);
  const immersive = variant === "immersive";

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

  const view = useMemo(() => {
    const p = parseDateStr(selectedDate);
    if (!p) {
      const now = new Date();
      return { y: now.getFullYear(), m: now.getMonth() + 1 };
    }
    return { y: p.y, m: p.m };
  }, [selectedDate]);

  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);
  const week = useMemo(() => weekDates(selectedDate), [selectedDate]);

  function goMonth(delta: number) {
    const next = shiftMonth(view.y, view.m, delta);
    const p = parseDateStr(selectedDate);
    const d = Math.min(p?.d ?? 1, daysInMonth(next.y, next.m));
    setSelectedDate(toDateStr(next.y, next.m, d));
    const range = monthGridRange(next.y, next.m);
    onRangeChange?.(range.from, range.to);
  }

  function goWeek(delta: number) {
    const next = shiftWeek(selectedDate, delta);
    setSelectedDate(next);
    const days = weekDates(next);
    onRangeChange?.(days[0], days[6]);
  }

  function goToday() {
    const t = todayStr();
    setSelectedDate(t);
    const days = weekDates(t);
    onRangeChange?.(days[0], days[6]);
  }

  if (isWeek) {
    const monday = week[0];
    const sunday = week[6];
    const mp = parseDateStr(monday);
    let titleY = mp ? mp.y : view.y;
    let titleM = mp ? mp.m : view.m;
    if (mp) {
      const prefix = monday.slice(0, 7);
      if (week.filter((d) => d.slice(0, 7) === prefix).length < 4) {
        const sp = parseDateStr(sunday);
        if (sp) {
          titleY = sp.y;
          titleM = sp.m;
        }
      }
    }
    const rangeLabel = formatWeekRange(monday, sunday);

    return (
      <div className="w-full select-none">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goWeek(-1)}
              className="rounded-md border border-vine/50 px-2.5 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
              aria-label="上一周"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => goWeek(1)}
              className="rounded-md border border-vine/50 px-2.5 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
              aria-label="下一周"
            >
              ›
            </button>
          </div>
          <h2 className="font-serif text-lg font-semibold text-ink">
            {titleY} 年 {titleM} 月 · {rangeLabel}
          </h2>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
          >
            今天
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {week.map((ds, i) => {
            const p = parseDateStr(ds)!;
            const dayEntries = entriesByDate.get(ds) ?? [];
            const isToday = ds === today;
            const isPast = ds < today;
            return (
              <button
                key={ds}
                type="button"
                data-date={ds}
                data-testid="calendar-day"
                onClick={() => onSelectDay?.(ds)}
                aria-label={`查看 ${ds} 安排`}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  isToday ? "border-flower" : "border-vine/40"
                } ${isToday ? "" : isPast ? "bg-night opacity-60" : "bg-raised hover:border-flower"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-display text-sm ${
                      isToday ? "font-bold text-flower" : isPast ? "text-ink-dim" : "text-ink"
                    }`}
                  >
                    周{WEEKDAYS[i]}
                  </span>
                  <span className={`text-xs tabular-nums ${isToday ? "text-flower" : "text-ink-dim"}`}>
                    {p.m} 月 {p.d} 日
                  </span>
                  {isToday && (
                    <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-flower" />
                  )}
                </div>
                <div className="mt-1.5">
                  <DaySummaries entries={dayEntries} isPast={isPast} maxSummaries={WEEK_MAX_SUMMARIES} showEmpty />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full w-full flex-col select-none ${immersive ? "relative" : ""}`}>
      {!immersive && (
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
      )}

      {immersive && (
        <>
          <div className="mb-4 flex items-center justify-center">
            <h2 className="font-serif text-xl font-semibold text-ink sm:text-2xl">
              {view.y} 年 {view.m} 月
            </h2>
          </div>
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="absolute inset-y-0 left-0 flex w-12 items-center justify-center text-2xl text-ink-dim transition-colors hover:text-flower sm:w-16"
            aria-label="上月"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-2xl text-ink-dim transition-colors hover:text-flower sm:w-16"
            aria-label="下月"
          >
            ›
          </button>
        </>
      )}

      <div className={immersive ? "grid grid-cols-7 gap-1 px-12 sm:px-16" : "grid grid-cols-7 gap-1"}>
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center font-display text-xs tracking-widest text-ink-dim"
          >
            周{w}
          </div>
        ))}
      </div>

      <div
        data-testid={immersive ? "immersive-grid" : undefined}
        onPointerDown={immersive ? (e) => { dragRef.current = createDrag(); lastXRef.current = e.clientX; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } : undefined}
        onPointerMove={immersive ? (e) => { if (lastXRef.current !== null) feedPointer(dragRef.current, e.clientX - lastXRef.current); lastXRef.current = e.clientX; } : undefined}
        onPointerUp={immersive ? () => { lastXRef.current = null; const d = release(dragRef.current); if (d === 1) goMonth(1); else if (d === -1) goMonth(-1); } : undefined}
        className={`grid h-full min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1 ${immersive ? "touch-pan-y cursor-grab" : ""}`}
      >
        {cells.map((cell) => (
          <DayCell
            key={cell.dateStr}
            dateStr={cell.dateStr}
            day={cell.d}
            inMonth={cell.inMonth}
            entries={entriesByDate.get(cell.dateStr) ?? []}
            today={today}
            maxSummaries={MONTH_MAX_SUMMARIES}
            onSelectDay={onSelectDay}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
