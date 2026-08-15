import { describe, it, expect } from "vitest";
import { weekDates, shiftWeek, formatWeekRange } from "@/features/schedule/dateUtils";

describe("weekDates", () => {
  it("返回含该日期的周一~周日 7 天（周一为首日）", () => {
    expect(weekDates("2026-08-15")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });

  it("当天为周一/周日边界均返回同一周", () => {
    expect(weekDates("2026-08-10")[0]).toBe("2026-08-10");
    expect(weekDates("2026-08-16")[6]).toBe("2026-08-16");
    expect(weekDates("2026-08-10")).toEqual(weekDates("2026-08-16"));
  });

  it("跨月：8/31 所在周含 9/1 及 9/6", () => {
    expect(weekDates("2026-08-31")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });

  it("跨年：2026-12-28 所在周含 2027-01-01", () => {
    expect(weekDates("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("非法日期返回空数组", () => {
    expect(weekDates("2026-02-30")).toEqual([]);
  });
});

describe("shiftWeek", () => {
  it("±1 周平移 7 天", () => {
    expect(shiftWeek("2026-08-15", 1)).toBe("2026-08-22");
    expect(shiftWeek("2026-08-15", -1)).toBe("2026-08-08");
  });

  it("±N 步跨月/跨年正确", () => {
    expect(shiftWeek("2026-08-15", 3)).toBe("2026-09-05");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
    expect(shiftWeek("2026-12-28", -1)).toBe("2026-12-21");
    expect(shiftWeek("2026-01-03", -1)).toBe("2025-12-27");
  });
});

describe("formatWeekRange", () => {
  it("同月：仅左端带月份", () => {
    expect(formatWeekRange("2026-08-10", "2026-08-16")).toBe("8/10 – 8/16");
  });

  it("跨月：两端各带月份", () => {
    expect(formatWeekRange("2026-08-31", "2026-09-06")).toBe("8/31 – 9/6");
  });

  it("跨年：两端各带月份", () => {
    expect(formatWeekRange("2026-12-28", "2027-01-03")).toBe("12/28 – 1/3");
  });

  it("非法输入原样回退", () => {
    expect(formatWeekRange("bad", "2026-08-16")).toBe("bad – 2026-08-16");
  });
});
