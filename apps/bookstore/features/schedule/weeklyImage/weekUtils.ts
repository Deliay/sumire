import { toDateStr } from "../dateUtils";

export interface ISOWeek {
  year: number;
  week: number;
}

/**
 * 计算某日历日（本地时区）所在的 ISO-8601 周（周一为一周首日，1 月 4 日所在周为第 1 周）。
 * 自实现算法，不引入日期库。
 */
export function getISOWeek(date: Date): ISOWeek {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // 本周周四（ISO 周归属年由周四决定）
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const year = thursday.getFullYear();

  // 该年 1 月 4 日所在周的周一（即第 1 周周一）
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // 0=周一 … 6=周日
  const week1Monday = new Date(year, 0, 4 - jan4Day);

  const diffDays = Math.round((thursday.getTime() - week1Monday.getTime()) / 86_400_000);
  return { year, week: Math.floor(diffDays / 7) + 1 };
}

/** 计算某 ISO 周（year, week）的周一与周日（YYYY-MM-DD）。 */
export function getWeekRange(year: number, week: number): { monday: string; sunday: string } {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(year, 0, 4 - jan4Day);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: toDateStr(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
    sunday: toDateStr(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()),
  };
}

/** 周平移 delta 周（可为负），返回新 ISO 周。 */
export function shiftWeek(year: number, week: number, delta: number): ISOWeek {
  const { monday } = getWeekRange(year, week);
  const [y, m, d] = monday.split("-").map(Number);
  const moved = new Date(y, m - 1, d);
  moved.setDate(moved.getDate() + delta * 7);
  return getISOWeek(moved);
}

/** 周标签「2026 年第 33 周」。 */
export function formatWeekLabel(year: number, week: number): string {
  return `${year} 年第 ${week} 周`;
}
