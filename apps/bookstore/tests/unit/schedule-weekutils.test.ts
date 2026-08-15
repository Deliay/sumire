import { describe, it, expect } from "vitest";
import {
  getISOWeek,
  getWeekRange,
  shiftWeek,
  formatWeekLabel,
} from "@/features/schedule/weeklyImage/weekUtils";

function d(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

describe("getISOWeek", () => {
  it("1 月 4 日所在周为第 1 周（2026-01-01 为周四）", () => {
    expect(getISOWeek(d("2026-01-01"))).toEqual({ year: 2026, week: 1 });
    expect(getISOWeek(d("2026-01-04"))).toEqual({ year: 2026, week: 1 });
  });

  it("年末跨年：上一年末周一归入下一年第 1 周", () => {
    expect(getISOWeek(d("2025-12-29"))).toEqual({ year: 2026, week: 1 });
    expect(getISOWeek(d("2025-12-31"))).toEqual({ year: 2026, week: 1 });
  });

  it("年末跨界：2026-12-28 属 2026 年第 53 周（2026 有 53 周）", () => {
    expect(getISOWeek(d("2026-12-28"))).toEqual({ year: 2026, week: 53 });
    expect(getISOWeek(d("2026-12-31"))).toEqual({ year: 2026, week: 53 });
    // 次年 1 月 1 日仍属上一年的最后一周
    expect(getISOWeek(d("2027-01-01"))).toEqual({ year: 2026, week: 53 });
    expect(getISOWeek(d("2027-01-04"))).toEqual({ year: 2027, week: 1 });
  });
});

describe("getWeekRange", () => {
  it("2026 第 1 周 = 2025-12-29 ~ 2026-01-04", () => {
    expect(getWeekRange(2026, 1)).toEqual({ monday: "2025-12-29", sunday: "2026-01-04" });
  });

  it("周内 7 天覆盖周一~周日", () => {
    const { monday, sunday } = getWeekRange(2026, 33);
    const [y, m, day] = monday.split("-").map(Number);
    const start = new Date(y, m - 1, day);
    expect(start.getDay()).toBe(1); // 周一
    const [sy, sm, sd] = sunday.split("-").map(Number);
    const end = new Date(sy, sm - 1, sd);
    const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    expect(diff).toBe(6);
  });
});

describe("shiftWeek", () => {
  it("跨年 shift 正确", () => {
    expect(shiftWeek(2026, 1, -1)).toEqual({ year: 2025, week: 52 });
    expect(shiftWeek(2026, 53, 1)).toEqual({ year: 2027, week: 1 });
    expect(shiftWeek(2026, 33, 0)).toEqual({ year: 2026, week: 33 });
  });
});

describe("formatWeekLabel", () => {
  it("格式化「2026 年第 33 周」", () => {
    expect(formatWeekLabel(2026, 33)).toBe("2026 年第 33 周");
  });
});
