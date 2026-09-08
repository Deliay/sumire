export type TimeType = "fixed" | "tbd" | "allDay";

/** 类型秩：allDay 0 / fixed 1 / tbd 2 */
export function timeTypeRank(t: TimeType): number {
  return t === "allDay" ? 0 : t === "fixed" ? 1 : 2;
}

/** 比较两个计划：date 升序 → 类型秩 → startTime 升序（null 兜底空串） */
export function comparePlans(a: { date: string; timeType: TimeType; startTime: string | null }, b: { date: string; timeType: TimeType; startTime: string | null }): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  const rankCmp = timeTypeRank(a.timeType) - timeTypeRank(b.timeType);
  if (rankCmp !== 0) return rankCmp;
  return (a.startTime ?? "").localeCompare(b.startTime ?? "");
}

/** 格式化计划标签：fixed → "HH:mm 主题"，tbd → "TBD 主题"，allDay → "主题" */
export function formatPlanLabel(plan: { timeType: TimeType; startTime: string | null; title: string }): string {
  if (plan.timeType === "fixed") return `${plan.startTime} ${plan.title}`;
  if (plan.timeType === "tbd") return `TBD ${plan.title}`;
  return plan.title;
}

/** 时间槽位文案：fixed → "HH:mm"，tbd → "TBD"，allDay → "全天" */
export function planTimeSlot(plan: { timeType: TimeType; startTime: string | null }): string {
  if (plan.timeType === "fixed") return plan.startTime ?? "";
  if (plan.timeType === "tbd") return "TBD";
  return "全天";
}