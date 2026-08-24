// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadDefault,
  saveDefault,
  loadWeek,
  saveWeek,
  deleteWeek,
  hasWeek,
  weekKey,
  clearMemoryCache,
} from "../../features/schedule/weeklyImage/storage";
import { createDefaultScheme } from "../../features/schedule/weeklyImage/scheme";
import type { WeekScheme } from "../../features/schedule/weeklyImage/scheme";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMemoryCache();
  });

  describe("saveDefault/loadDefault", () => {
    it("should save and load default scheme", () => {
      const scheme = createDefaultScheme();
      saveDefault(scheme);
      const loaded = loadDefault();
      expect(loaded).toStrictEqual(scheme);
    });

    it("should load default scheme if no saved scheme", () => {
      const loaded = loadDefault();
      expect(loaded).toStrictEqual(createDefaultScheme());
    });
  });

  describe("saveWeek/loadWeek", () => {
    it("should save and load week scheme", () => {
      const weekScheme: WeekScheme = {
        version: 1,
        global: { align: "right", fontSize: 30, color: "#ff0000" },
        days: Array(7).fill({ content: "test" }),
        week: { year: 2026, week: 33 },
      };
      saveWeek(weekScheme);
      const loaded = loadWeek({ year: 2026, week: 33 });
      expect(loaded).toStrictEqual(weekScheme);
    });

    it("should return null for non-existent week", () => {
      const loaded = loadWeek({ year: 2026, week: 33 });
      expect(loaded).toBeNull();
    });
  });

  describe("deleteWeek", () => {
    it("should delete week scheme", () => {
      const weekScheme: WeekScheme = {
        version: 1,
        global: { align: "right", fontSize: 30, color: "#ff0000" },
        days: Array(7).fill({ content: "test" }),
        week: { year: 2026, week: 33 },
      };
      saveWeek(weekScheme);
      deleteWeek({ year: 2026, week: 33 });
      expect(hasWeek({ year: 2026, week: 33 })).toBe(false);
      expect(loadWeek({ year: 2026, week: 33 })).toBeNull();
    });
  });

  describe("hasWeek", () => {
    it("should return true for existing week", () => {
      const weekScheme: WeekScheme = {
        version: 1,
        global: { align: "right", fontSize: 30, color: "#ff0000" },
        days: Array(7).fill({ content: "test" }),
        week: { year: 2026, week: 33 },
      };
      saveWeek(weekScheme);
      expect(hasWeek({ year: 2026, week: 33 })).toBe(true);
    });

    it("should return false for non-existent week", () => {
      expect(hasWeek({ year: 2026, week: 33 })).toBe(false);
    });
  });

  describe("weekKey", () => {
    it("should generate correct week key", () => {
      expect(weekKey(2026, 33)).toBe("weekly-image.week.2026-33");
    });
  });

  describe("error handling", () => {
    it("should fallback to default for corrupted JSON", () => {
      localStorage.setItem("weekly-image.default", "corrupted json");
      const loaded = loadDefault();
      expect(loaded).toStrictEqual(createDefaultScheme());
    });

    it("should fallback to default for invalid Zod schema", () => {
      localStorage.setItem(
        "weekly-image.default",
        JSON.stringify({
          version: 1,
          global: { align: "invalid", fontSize: 40, color: "#b4a6bf" },
          days: Array(7).fill({ content: "{schedules}" }),
        })
      );
      const loaded = loadDefault();
      expect(loaded).toStrictEqual(createDefaultScheme());
    });

    it("should fallback to default when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("localStorage not available");
      });
      const loaded = loadDefault();
      expect(loaded).toStrictEqual(createDefaultScheme());
      vi.restoreAllMocks();
    });
  });
});