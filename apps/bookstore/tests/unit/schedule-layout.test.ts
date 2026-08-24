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
  it("无计划（或不在该周）输出日期指令但无每日指令", () => {
    const out1 = layoutWeek([], "2026-08-10", charMeasure);
    expect(out1).toHaveLength(1);
    expect(out1[0].dayIndex).toBe(-1);
    
    const out2 = layoutWeek([plan("2026-08-02", "20:00", "x")], "2026-08-10", charMeasure);
    expect(out2).toHaveLength(1);
    expect(out2[0].dayIndex).toBe(-1);
  });

  it("计划映射到正确 dayIndex 与素材坐标", () => {
    const monday = "2026-08-10"; // 周一
    const out = layoutWeek([plan("2026-08-11", "20:00", "周二场", "1")], monday, charMeasure);
    expect(out).toHaveLength(2);
    const dayInstruction = out.find(i => i.dayIndex === 1);
    expect(dayInstruction).toBeDefined();
    expect(dayInstruction!.x).toBe(ROW_X);
    expect(dayInstruction!.y).toBe(ROW_Y[1]);
    expect(dayInstruction!.width).toBe(ROW_WIDTH);
    expect(dayInstruction!.height).toBe(ROW_HEIGHT);
    expect(dayInstruction!.text).toBe("20:00 周二场");
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
    expect(out).toHaveLength(2);
    const dayInstruction = out.find(i => i.dayIndex === 0);
    expect(dayInstruction).toBeDefined();
    expect(dayInstruction!.text).toBe("08:00 早 / 13:00 午 / 20:00 晚");
  });

  it("字号 shrink-to-fit：超宽文本降低字号", () => {
    const monday = "2026-08-10";
    const long = "20:00 " + "超长主题".repeat(20);
    const out = layoutWeek([plan("2026-08-10", "20:00", long.slice(5), "1")], monday, charMeasure);
    expect(out).toHaveLength(2);
    const dayInstruction = out.find(i => i.dayIndex === 0);
    expect(dayInstruction).toBeDefined();
    expect(dayInstruction!.fontSize).toBeLessThan(BASE_FONT_SIZE);
    expect(dayInstruction!.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE);
  });

  it("触底仍超宽时截断加「…」", () => {
    const monday = "2026-08-10";
    const huge = "20:00 " + "字".repeat(500);
    const out = layoutWeek([plan("2026-08-10", "20:00", "字".repeat(500), "1")], monday, charMeasure);
    expect(out).toHaveLength(2);
    const dayInstruction = out.find(i => i.dayIndex === 0);
    expect(dayInstruction).toBeDefined();
    expect(dayInstruction!.fontSize).toBe(MIN_FONT_SIZE);
    expect(dayInstruction!.text.endsWith("…")).toBe(true);
    expect(dayInstruction!.text.length).toBeLessThan(huge.length);
  });
});
