export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"] as const;

/** 将 YYYY-MM-DD 拆分为 { y, m, d }（m 为 1-12）。非法返回 null。 */
export function parseDateStr(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const d = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const last = new Date(y, month, 0).getDate();
  if (d < 1 || d > last) return null;
  return { y, m: month, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 当月 1 号是星期几，以周一为 0（0=周一 … 6=周日）。 */
export function firstWeekdayMondayBased(y: number, m: number): number {
  const day = new Date(y, m - 1, 1).getDay(); // 0=周日 … 6=周六
  return (day + 6) % 7;
}

export interface GridCell {
  y: number;
  m: number;
  d: number;
  dateStr: string;
  /** 是否属于当前展示月份（翻月时补位格为 false） */
  inMonth: boolean;
}

/**
 * 生成某月的日历网格（周一开头，固定 6 行 x 7 列）。
 * 月初/月末以相邻月日期补位，标记 inMonth=false。
 */
export function monthGrid(y: number, m: number): GridCell[] {
  const cells: GridCell[] = [];
  const offset = firstWeekdayMondayBased(y, m);
  const prevMonthLast = daysInMonth(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;

  // 月初补位
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevMonthLast - i;
    cells.push({ y: prevY, m: prevM, d, dateStr: toDateStr(prevY, prevM, d), inMonth: false });
  }

  // 当月天数
  const total = daysInMonth(y, m);
  for (let d = 1; d <= total; d++) {
    cells.push({ y, m, d, dateStr: toDateStr(y, m, d), inMonth: true });
  }

  // 月末补位到 6 行满
  let nextD = 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  while (cells.length < 42) {
    cells.push({ y: nextY, m: nextM, d: nextD, dateStr: toDateStr(nextY, nextM, nextD), inMonth: false });
    nextD++;
  }
  return cells;
}

export function toDateStr(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** 某年某月的 from/to 区间（YYYY-MM-DD，含首末）。 */
export function monthRange(y: number, m: number): { from: string; to: string } {
  return { from: toDateStr(y, m, 1), to: toDateStr(y, m, daysInMonth(y, m)) };
}

export function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + delta;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

/**
 * 容错解析 HH:mm（接受缺位如 "9:5"→"09:05"），返回归一化的 "HH:mm" 或 null。
 * 拒绝 24:00 / 12:60 等非法时间。
 */
export function parseTimeStr(value: string): string | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
