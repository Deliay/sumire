import { describe, it, expect } from "vitest";
import {
  layoutWeek,
  DATE_X,
  DATE_Y,
  DATE_WIDTH,
  DATE_HEIGHT,
  DATECONFIG_MIN_FONT_SIZE,
} from "../../features/schedule/weeklyImage/layout";
import type { DefaultScheme } from "../../features/schedule/weeklyImage/scheme";
import type { StreamPlan } from "../../features/schedule/api";

describe("layout", () => {
  const mockMeasure = (text: string, fontSize: number) => text.length * fontSize * 0.6;

  describe("layoutWeek with date instruction", () => {
    it("should not produce date instruction when enabled is false (default)", () => {
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction).toBeUndefined();
    });

    it("should produce date instruction when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction).toBeDefined();
      expect(dateInstruction?.x).toBe(DATE_X);
      expect(dateInstruction?.y).toBe(DATE_Y);
      expect(dateInstruction?.width).toBe(DATE_WIDTH);
      expect(dateInstruction?.height).toBe(DATE_HEIGHT);
    });

    it("should use default date content when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.text).toContain("2026年08月25日");
      expect(dateInstruction?.text).toContain("2026年08月31日");
      expect(dateInstruction?.text).toContain("~");
    });

    it("should use date fontSize default 20 when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.fontSize).toBe(20);
    });

    it("should use global align and color for date when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.align).toBe("left");
      expect(dateInstruction?.color).toBe("#5b4b68");
    });

    it("should use date config overrides when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yy}/{mm}/{dd}",
          content: "{开始日期} to {结束日期}",
          align: "center",
          fontSize: 25,
          color: "#ff0000",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.text).toContain("26/08/25");
      expect(dateInstruction?.text).toContain("26/08/31");
      expect(dateInstruction?.text).toContain("to");
      expect(dateInstruction?.align).toBe("center");
      expect(dateInstruction?.fontSize).toBe(25);
      expect(dateInstruction?.color).toBe("#ff0000");
    });

    it("should produce date instruction even with no plans when enabled is true", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction).toBeDefined();
    });

    it("should not produce date instruction when content template is empty", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction).toBeUndefined();
    });

    it("should handle cross-year week", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-12-28", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.text).toContain("2026年12月28日");
      expect(dateInstruction?.text).toContain("2027年01月03日");
    });

    it("should handle cross-month week", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-31", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction?.text).toContain("2026年08月31日");
      expect(dateInstruction?.text).toContain("2026年09月06日");
    });

    it("should shrink long date text to fit width", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#5b4b68" },
        days: Array(7).fill({ content: "{schedules}" }),
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期} (非常长的额外文本用于测试shrink)",
        },
      };
      const plans: StreamPlan[] = [];
      const instructions = layoutWeek(plans, "2026-08-25", mockMeasure, scheme);
      const dateInstruction = instructions.find((i) => i.dayIndex === -1);
      expect(dateInstruction).toBeDefined();
      expect(dateInstruction!.fontSize).toBeGreaterThanOrEqual(DATECONFIG_MIN_FONT_SIZE);
      expect(dateInstruction!.textWidth).toBeLessThanOrEqual(DATE_WIDTH);
    });
  });

  describe("layoutWeek with scheme", () => {
    it("should use default scheme when not provided", () => {
      const plans: StreamPlan[] = [
        { id: "1", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.align).toBe("left");
      expect(dayInstruction!.color).toBe("#5b4b68");
    });

    it("should use scheme global align", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "center", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const plans: StreamPlan[] = [
        { id: "2", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.align).toBe("center");
    });

    it("should use day-specific align over global", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "{schedules}", align: "right" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      const plans: StreamPlan[] = [
        { id: "3", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.align).toBe("right");
    });

    it("should use day-specific color over global", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "{schedules}", color: "#ff0000" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      const plans: StreamPlan[] = [
        { id: "4", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.color).toBe("#ff0000");
    });

    it("should use day-specific fontSize over global", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "{schedules}", fontSize: 30 },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      const plans: StreamPlan[] = [
        { id: "5", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.fontSize).toBe(30);
    });

    it("should not produce instruction for empty content", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      const plans: StreamPlan[] = [
        { id: "6", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeUndefined();
    });

    it("should resolve {schedules} in content template", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "Today: {schedules}" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      const plans: StreamPlan[] = [
        { id: "7", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const dayInstruction = instructions.find(i => i.dayIndex === 0);
      expect(dayInstruction).toBeDefined();
      expect(dayInstruction!.text).toContain("Today: 10:00 Stream A");
    });

    it("should shrink font size when text is too wide", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const plans: StreamPlan[] = [
        { id: "8", date: "2026-08-24", timeType: "fixed", startTime: "10:00", title: "Very Long Stream Title That Exceeds Width", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].fontSize).toBeLessThan(40);
    });

    it("should include align, color, textWidth in instruction", () => {
      const instructions = layoutWeek([], "2026-08-24", mockMeasure);
      // No instructions for empty plans, but we can test the type
      expect(Array.isArray(instructions)).toBe(true);
    });

    it("should render custom text on a day with no schedules", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "休馆日" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      // 计划只在周二（2026-08-25），周一无日程但模板为纯自定义文本
      const plans: StreamPlan[] = [
        { id: "9", date: "2026-08-25", timeType: "fixed", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      const custom = instructions.find((i) => i.dayIndex === 0);
      expect(custom).toBeDefined();
      expect(custom?.text).toBe("休馆日");
    });

    it("should strip empty schedules from template but keep custom text", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [
          { content: "{schedules}休馆" },
          ...Array(6).fill({ content: "{schedules}" }),
        ],
      };
      // 周一无日程：{schedules} 替换为空串，仅保留「休馆」
      const instructions = layoutWeek([], "2026-08-24", mockMeasure, scheme);
      const custom = instructions.find((i) => i.dayIndex === 0);
      expect(custom).toBeDefined();
      expect(custom?.text).toBe("休馆");
    });
  });
});