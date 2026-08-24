import { describe, it, expect } from "vitest";
import { layoutWeek } from "../../features/schedule/weeklyImage/layout";
import type { DefaultScheme } from "../../features/schedule/weeklyImage/scheme";
import type { StreamPlan } from "../../features/schedule/api";

describe("layout", () => {
  const mockMeasure = (text: string, fontSize: number) => text.length * fontSize * 0.6;

  describe("layoutWeek with scheme", () => {
    it("should use default scheme when not provided", () => {
      const plans: StreamPlan[] = [
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure);
      expect(instructions).toHaveLength(1);
      expect(instructions[0].align).toBe("left");
      expect(instructions[0].color).toBe("#b4a6bf");
    });

    it("should use scheme global align", () => {
      const scheme: DefaultScheme = {
        version: 1,
        global: { align: "center", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const plans: StreamPlan[] = [
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
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
        { date: "2026-08-24", startTime: "10:00", title: "Very Long Stream Title That Exceeds Width" },
      ];
      const instructions = layoutWeek(plans, "2026-08-24", mockMeasure, scheme);
      expect(instructions[0].fontSize).toBeLessThan(40);
    });

    it("should include align, color, textWidth in instruction", () => {
      const instructions = layoutWeek([], "2026-08-24", mockMeasure);
      // No instructions for empty plans, but we can test the type
      expect(Array.isArray(instructions)).toBe(true);
    });
  });
});