import type { StreamPlan, LiveRecord } from "./api";
import { comparePlans, type TimeType } from "./timeType";

export type CalendarEntry =
  | { kind: "plan"; plan: StreamPlan; date: string; startTime: string | null }
  | {
      kind: "history";
      record: LiveRecord;
      date: string;
      startTime: string;
      endTime?: string;
    };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO 时间戳按本地时区折算为 YYYY-MM-DD 与 HH:mm。非法返回 null。 */
export function localDateTime(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** 条目类型秩：allDay 计划 0 / 历史与 fixed 计划 1 / tbd 计划 2 */
function entryTypeRank(entry: CalendarEntry): number {
  if (entry.kind === "history") return 1; // 历史视同 fixed 秩
  const t = entry.plan.timeType ?? "fixed";
  return t === "allDay" ? 0 : t === "fixed" ? 1 : 2;
}

/**
 * 归一化合并人工计划与历史直播记录为统一日历条目，按 date 升序，同日按 全天 → 固定时间（startTime 升序）→ 时间待定 混排。
 * 历史记录按 startDate 本地时区归入开播当日（跨天归开播当日）；缺 title/startDate 丢弃；
 * 已过 now 的「未来」记录（上游异常）不纳入。同日同时两条都保留不去重。
 */
export function mergeEntries(
  plans: StreamPlan[],
  records: LiveRecord[],
  now: Date = new Date(),
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];

  for (const plan of plans) {
    entries.push({ kind: "plan", plan, date: plan.date, startTime: plan.startTime });
  }

  for (const record of records) {
    if (!record.title || !record.startDate) continue;
    const start = localDateTime(record.startDate);
    if (!start) continue;
    const startMs = new Date(record.startDate).getTime();
    if (Number.isNaN(startMs) || startMs > now.getTime()) continue;
    const entry: CalendarEntry = {
      kind: "history",
      record,
      date: start.date,
      startTime: start.time,
    };
    if (record.stopDate) {
      const end = localDateTime(record.stopDate);
      if (end) entry.endTime = end.time;
    }
    entries.push(entry);
  }

  return entries.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const rankCmp = entryTypeRank(a) - entryTypeRank(b);
    if (rankCmp !== 0) return rankCmp;
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}
