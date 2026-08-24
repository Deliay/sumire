import { describe, it, expect } from "vitest";
import {
  createDefaultScheme,
  resolveEffectiveScheme,
  resolveDayText,
  buildDaySchedulesText,
  ensureWeekScheme,
  type DefaultScheme,
  type WeekScheme,
} from "../../features/schedule/weeklyImage/scheme";
import type { StreamPlan } from "../../features/schedule/api";

describe("scheme", () => {
  describe("createDefaultScheme", () => {
    it("should create default scheme with correct values", () => {
      const scheme = createDefaultScheme();
      expect(scheme.version).toBe(1);
      expect(scheme.global.align).toBe("left");
      expect(scheme.global.fontSize).toBe(40);
      expect(scheme.global.color).toBe("#5b4b68");
      expect(scheme.days).toHaveLength(7);
      for (const day of scheme.days) {
        expect(day.content).toBe("{schedules}");
      }
    });
  });

  describe("resolveEffectiveScheme", () => {
    it("should return week scheme if available", () => {
      const weekScheme: WeekScheme = {
        version: 1,
        global: { align: "right", fontSize: 30, color: "#ff0000" },
        days: Array(7).fill({ content: "test" }),
        week: { year: 2026, week: 33 },
      };
      const store = {
        getWeek: () => weekScheme,
        getDefault: () => createDefaultScheme(),
      };
      const result = resolveEffectiveScheme({ year: 2026, week: 33 }, store);
      expect(result).toStrictEqual(weekScheme);
    });

    it("should return default scheme if no week scheme", () => {
      const defaultScheme = createDefaultScheme();
      const store = {
        getWeek: () => null,
        getDefault: () => defaultScheme,
      };
      const result = resolveEffectiveScheme({ year: 2026, week: 33 }, store);
      expect(result).toBe(defaultScheme);
    });

    it("should fallback to default on invalid Zod input", () => {
      const invalidScheme = {
        version: 1,
        global: { align: "invalid", fontSize: 40, color: "#b4a6bf" },
        days: Array(7).fill({ content: "{schedules}" }),
      };
      const store = {
        getWeek: () => invalidScheme,
        getDefault: () => createDefaultScheme(),
      };
      const result = resolveEffectiveScheme({ year: 2026, week: 33 }, store);
      expect(result).toStrictEqual(store.getDefault());
    });
  });

  describe("resolveDayText", () => {
    it("should replace {schedules} with schedules", () => {
      const result = resolveDayText("{schedules}", "10:00 Stream / 12:00 Stream");
      expect(result).toBe("10:00 Stream / 12:00 Stream");
    });

    it("should return template as-is if no {schedules}", () => {
      const result = resolveDayText("No schedules today", "10:00 Stream");
      expect(result).toBe("No schedules today");
    });

    it("should replace {schedules} with empty string if schedules is empty", () => {
      const result = resolveDayText("{schedules}", "");
      expect(result).toBe("");
    });

    it("should handle multiple {schedules} placeholders", () => {
      const result = resolveDayText("{schedules} and {schedules}", "10:00 Stream");
      expect(result).toBe("10:00 Stream and 10:00 Stream");
    });

    it("should handle custom template with {schedules}", () => {
      const result = resolveDayText("Today: {schedules}", "10:00 Stream");
      expect(result).toBe("Today: 10:00 Stream");
    });
  });

  describe("buildDaySchedulesText", () => {
    it("should join plans sorted by startTime", () => {
      const plans: StreamPlan[] = [
        { date: "2026-08-24", startTime: "12:00", title: "Stream B" },
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
      ];
      const result = buildDaySchedulesText(plans);
      expect(result).toBe("10:00 Stream A / 12:00 Stream B");
    });

    it("should return empty string for empty array", () => {
      const result = buildDaySchedulesText([]);
      expect(result).toBe("");
    });

    it("should handle single plan", () => {
      const plans: StreamPlan[] = [
        { date: "2026-08-24", startTime: "10:00", title: "Stream A" },
      ];
      const result = buildDaySchedulesText(plans);
      expect(result).toBe("10:00 Stream A");
    });
  });

  describe("ensureWeekScheme", () => {
    it("should deep clone base scheme", () => {
      const base: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [{ content: "{schedules}" }],
      };
      const weekScheme = ensureWeekScheme(base, { year: 2026, week: 33 });
      expect(weekScheme).not.toBe(base);
      expect(weekScheme.global).not.toBe(base.global);
      expect(weekScheme.days).not.toBe(base.days);
      expect(weekScheme.week).toEqual({ year: 2026, week: 33 });
    });

    it("should not modify base scheme", () => {
      const base: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [{ content: "{schedules}" }],
      };
      const weekScheme = ensureWeekScheme(base, { year: 2026, week: 33 });
      weekScheme.global.align = "right";
      expect(base.global.align).toBe("left");
    });
  });
});