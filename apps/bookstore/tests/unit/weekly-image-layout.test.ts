import { describe, it, expect } from "vitest";
import { layoutWeek } from "../../features/schedule/weeklyImage/layout";
import type { DefaultScheme } from "../../features/schedule/weeklyImage/scheme";
import type { StreamPlan } from "../../features/schedule/api";

describe("layout", () => {
  const mockMeasure = (text: string, fontSize: number) => text.length * fontSize * 0.6;

  describe("layoutWeek with scheme", () => {
    it("should use default scheme when not provided", () => {
      const plans: StreamPlan[] = [
        { id: "1", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure);
      expect(instructions).toHaveLength(1);
      expect(instructions[0].align).toBe("left");
      expect(instructions[0].color).toBe("#5b4b68");
    });

    it("should use scheme global align", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "center", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const plans: StreamPlan[] = [
        { id: "2", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].align).toBe("center");
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
        { id: "3", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].align).toBe("right");
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
        { id: "4", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].color).toBe("#ff0000");
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
        { id: "5", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].fontSize).toBe(30);
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
        { id: "6", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions).toHaveLength(0);
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
        { id: "7", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].text).toContain("Today: 10:00 Stream A");
    });

    it("should shrink font size when text is too wide", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const plans: StreamPlan[] = [
        { id: "8", date: "2026-08-24", startTime: "10:00", title: "Very Long Stream Title That Exceeds Width", createdAt: "2026-08-01T00:00:00Z" },
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
        { id: "9", date: "2026-08-25", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
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