import { describe, it, expect } from "vitest";
import {
  layoutWeek,
  ROW_X,
  ROW_Y,
  ROW_WIDTH,
  ROW_HEIGHT,
  BASE_FONT_SIZE,
  MIN_FONT_SIZE,
  type Measure,
} from "@/features/schedule/weeklyImage/layout";
import type { StreamPlan } from "@/features/schedule/api";

const plan = (date: string, startTime: string, title: string, id = title): StreamPlan => ({
  id,
  date,
  startTime,
  title,
  createdAt: "",
});

/** 按字符数近似的桩测量：每字宽约 fontSize。 */
const charMeasure: Measure = (text, fontSize) => text.length * fontSize;

describe("layoutWeek", () => {
  it("无计划（或不在该周）输出空指令", () => {
    expect(layoutWeek([], "2026-08-10", charMeasure)).toEqual([]);
    expect(layoutWeek([plan("2026-08-02", "20:00", "x")], "2026-08-10", charMeasure)).toEqual([]);
  });

  it("计划映射到正确 dayIndex 与素材坐标", () => {
    const monday = "2026-08-10"; // 周一
    const out = layoutWeek([plan("2026-08-11", "20:00", "周二场", "1")], monday, charMeasure);
    expect(out).toHaveLength(1);
    expect(out[0].dayIndex).toBe(1);
    expect(out[0].x).toBe(ROW_X);
    expect(out[0].y).toBe(ROW_Y[1]);
    expect(out[0].width).toBe(ROW_WIDTH);
    expect(out[0].height).toBe(ROW_HEIGHT);
    expect(out[0].text).toBe("20:00 周二场");
  });

  it("同日多场按 startTime 升序以「 / 」连接为单行", () => {
    const monday = "2026-08-10";
    const out = layoutWeek(
      [
        plan("2026-08-10", "20:00", "晚", "3"),
        plan("2026-08-10", "13:00", "午", "2"),
        plan("2026-08-10", "08:00", "早", "1"),
      ],
      monday,
      charMeasure,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("08:00 早 / 13:00 午 / 20:00 晚");
  });

  it("字号 shrink-to-fit：超宽文本降低字号", () => {
    const monday = "2026-08-10";
    const long = "20:00 " + "超长主题".repeat(20);
    const out = layoutWeek([plan("2026-08-10", "20:00", long.slice(5), "1")], monday, charMeasure);
    expect(out).toHaveLength(1);
    expect(out[0].fontSize).toBeLessThan(BASE_FONT_SIZE);
    expect(out[0].fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });

  it("触底仍超宽时截断加「…」", () => {
    const monday = "2026-08-10";
    const huge = "20:00 " + "字".repeat(500);
    const out = layoutWeek([plan("2026-08-10", "20:00", "字".repeat(500), "1")], monday, charMeasure);
    expect(out).toHaveLength(1);
    expect(out[0].fontSize).toBe(MIN_FONT_SIZE);
    expect(out[0].text.endsWith("…")).toBe(true);
    expect(out[0].text.length).toBeLessThan(huge.length);
  });
});
