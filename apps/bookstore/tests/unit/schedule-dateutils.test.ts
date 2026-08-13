import { describe, it, expect } from "vitest";
import {
  parseDateStr,
  monthGrid,
  daysInMonth,
  shiftMonth,
  toDateStr,
  monthRange,
} from "@/features/schedule/dateUtils";

describe("parseDateStr", () => {
  it("解析合法日期", () => {
    expect(parseDateStr("2026-08-15")).toEqual({ y: 2026, m: 8, d: 15 });
  });

  it("非法格式 → null", () => {
    expect(parseDateStr("2026/08/15")).toBeNull();
    expect(parseDateStr("2026-13-01")).toBeNull();
  });

  it("非真实日期（2026-02-30）→ null", () => {
    expect(parseDateStr("2026-02-30")).toBeNull();
  });

  it("闰年 2 月 29 合法、平年 2 月 29 非法", () => {
    expect(parseDateStr("2024-02-29")).not.toBeNull();
    expect(parseDateStr("2025-02-29")).toBeNull();
  });
});

describe("monthGrid", () => {
  it("固定 6 行 42 格且周一开头", () => {
    const grid = monthGrid(2026, 8);
    expect(grid).toHaveLength(42);
    expect(grid[0].dateStr).toBe("2026-07-27"); // 2026-08-01 是周六，周一开头首格为上月 27 日补位
    expect(grid[0].inMonth).toBe(false);
  });

  it("月初首格为该月 1 号（当月 1 号为周一）", () => {
    const grid = monthGrid(2026, 6); // 2026-06-01 是周一
    expect(grid[0].dateStr).toBe("2026-06-01");
    expect(grid[0].inMonth).toBe(true);
  });

  it("12 月 → 次年 1 月补位", () => {
    const grid = monthGrid(2026, 12);
    expect(grid[0].dateStr).toBe("2026-11-30");
    const last = grid[grid.length - 1];
    expect(last.dateStr).toBe("2027-01-10");
  });

  it("闰年 2 月含 29 天", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(monthGrid(2024, 2).filter((c) => c.inMonth)).toHaveLength(29);
  });
});

describe("shiftMonth", () => {
  it("12→1 翻年", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ y: 2025, m: 12 });
  });
});

describe("toDateStr", () => {
  it("补零", () => {
    expect(toDateStr(2026, 1, 5)).toBe("2026-01-05");
  });
});

describe("monthRange", () => {
  it("返回某月 from/to 区间（含首末）", () => {
    expect(monthRange(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange(2024, 2)).toEqual({ from: "2024-02-01", to: "2024-02-29" }); // 闰年
    expect(monthRange(2026, 8)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
});
