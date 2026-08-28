import { describe, it, expect } from "vitest";
import {
  createDefaultScheme,
  createDefaultDateConfig,
  resolveEffectiveScheme,
  resolveDayText,
  buildDaySchedulesText,
  ensureWeekScheme,
  formatDate,
  buildDateContent,
  resolveDateConfig,
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
        getWeek: () => invalidScheme as unknown as WeekScheme,
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
        { id: "1", date: "2026-08-24", startTime: "12:00", title: "Stream B", createdAt: "2026-08-01T00:00:00Z" },
        { id: "2", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
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
        { id: "3", date: "2026-08-24", startTime: "10:00", title: "Stream A", createdAt: "2026-08-01T00:00:00Z" },
      ];
      const result = buildDaySchedulesText(plans);
      expect(result).toBe("10:00 Stream A");
    });
  });

  describe("formatDate", () => {
    it("should format {yyyy} to four-digit year", () => {
      expect(formatDate("2026-08-31", "{yyyy}年{mm}月{dd}日")).toBe("2026年08月31日");
    });

    it("should format {yy} to two-digit year", () => {
      expect(formatDate("2026-08-31", "{yy}/{mm}/{dd}")).toBe("26/08/31");
    });

    it("should format {mm} to zero-padded month", () => {
      expect(formatDate("2026-01-05", "{yyyy}-{mm}-{dd}")).toBe("2026-01-05");
    });

    it("should format {m} to non-padded month", () => {
      expect(formatDate("2026-01-05", "{yyyy}-{m}-{d}")).toBe("2026-1-5");
    });

    it("should format {dd} to zero-padded day", () => {
      expect(formatDate("2026-08-09", "{yyyy}-{mm}-{dd}")).toBe("2026-08-09");
    });

    it("should format {d} to non-padded day", () => {
      expect(formatDate("2026-08-09", "{yyyy}-{m}-{d}")).toBe("2026-8-9");
    });

    it("should preserve non-variable text", () => {
      expect(formatDate("2026-08-31", "Date: {yyyy}年{mm}月{dd}日")).toBe("Date: 2026年08月31日");
    });

    it("should handle variables at any position", () => {
      expect(formatDate("2026-12-25", "{mm}/{dd}/{yyyy}")).toBe("12/25/2026");
    });
  });

  describe("buildDateContent", () => {
    it("should replace {开始日期} and {结束日期}", () => {
      expect(buildDateContent("{开始日期} ~ {结束日期}", "2026-08-25", "2026-08-31")).toBe("2026-08-25 ~ 2026-08-31");
    });

    it("should return empty string for empty template", () => {
      expect(buildDateContent("", "2026-08-25", "2026-08-31")).toBe("");
    });

    it("should handle custom separator", () => {
      expect(buildDateContent("{开始日期}/{结束日期}", "08/25", "08/31")).toBe("08/25/08/31");
    });
  });

  describe("createDefaultDateConfig", () => {
    it("should return default date config", () => {
      const config = createDefaultDateConfig();
      expect(config.enabled).toBe(false);
      expect(config.format).toBe("{yyyy}年{mm}月{dd}日");
      expect(config.content).toBe("{开始日期} ~ {结束日期}");
      expect(config.align).toBeUndefined();
      expect(config.fontSize).toBeUndefined();
      expect(config.color).toBeUndefined();
    });
  });

  describe("resolveDateConfig", () => {
    it("should return defaults when scheme has no date", () => {
      const scheme = createDefaultScheme();
      const config = resolveDateConfig(scheme);
      expect(config.enabled).toBe(false);
      expect(config.format).toBe("{yyyy}年{mm}月{dd}日");
      expect(config.content).toBe("{开始日期} ~ {结束日期}");
      expect(config.align).toBe("left");
      expect(config.fontSize).toBe(20);
      expect(config.color).toBe("#5b4b68");
    });

    it("should use date config when present", () => {
      const scheme = createDefaultScheme();
      scheme.date = {
        enabled: true,
        format: "{yy}/{mm}/{dd}",
        content: "{开始日期} to {结束日期}",
        align: "center",
        fontSize: 25,
        color: "#ff0000",
      };
      const config = resolveDateConfig(scheme);
      expect(config.enabled).toBe(true);
      expect(config.format).toBe("{yy}/{mm}/{dd}");
      expect(config.content).toBe("{开始日期} to {结束日期}");
      expect(config.align).toBe("center");
      expect(config.fontSize).toBe(25);
      expect(config.color).toBe("#ff0000");
    });

    it("should fallback to global when date partial", () => {
      const scheme = createDefaultScheme();
      scheme.date = {
        enabled: true,
        format: "{yyyy}",
        content: "{开始日期}",
      };
      const config = resolveDateConfig(scheme);
      expect(config.enabled).toBe(true);
      expect(config.align).toBe("left");
      expect(config.fontSize).toBe(20);
      expect(config.color).toBe("#5b4b68");
    });

    it("should handle invalid date config gracefully", () => {
      const scheme = createDefaultScheme();
      // @ts-expect-error -- intentionally invalid date config for testing
      (scheme as DefaultScheme & { date?: unknown }).date = { invalid: true };
      const config = resolveDateConfig(scheme);
      expect(config.enabled).toBe(false);
      expect(config.format).toBe("{yyyy}年{mm}月{dd}日");
      expect(config.content).toBe("{开始日期} ~ {结束日期}");
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

    it("should preserve date config when cloning", () => {
      const base: DefaultScheme = {
        version: 1,
        global: { align: "left", fontSize: 40, color: "#b4a6bf" },
        days: [{ content: "{schedules}" }],
        date: {
          enabled: true,
          format: "{yyyy}年{mm}月{dd}日",
          content: "{开始日期} ~ {结束日期}",
          fontSize: 25,
        },
      };
      const weekScheme = ensureWeekScheme(base, { year: 2026, week: 33 });
      expect(weekScheme.date).toEqual(base.date);
      expect(weekScheme.date).not.toBe(base.date);
    });
  });
});