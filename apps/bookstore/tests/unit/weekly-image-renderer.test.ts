import { describe, it, expect } from "vitest";
import { computeTextX } from "../../features/schedule/weeklyImage/renderer";

describe("renderer", () => {
  describe("computeTextX", () => {
    it("should return x for left align", () => {
      const result = computeTextX("left", 100, 200, 50);
      expect(result).toBe(100);
    });

    it("should return centered x for center align", () => {
      const result = computeTextX("center", 100, 200, 50);
      expect(result).toBe(175); // 100 + (200 - 50) / 2
    });

    it("should return right-aligned x for right align", () => {
      const result = computeTextX("right", 100, 200, 50);
      expect(result).toBe(250); // 100 + 200 - 50
    });

    it("should clamp when textWidth > width for left align", () => {
      const result = computeTextX("left", 100, 200, 250);
      expect(result).toBe(100);
    });

    it("should clamp when textWidth > width for center align", () => {
      const result = computeTextX("center", 100, 200, 250);
      expect(result).toBe(100);
    });

    it("should clamp when textWidth > width for right align", () => {
      const result = computeTextX("right", 100, 200, 250);
      expect(result).toBe(100);
    });
  });
});