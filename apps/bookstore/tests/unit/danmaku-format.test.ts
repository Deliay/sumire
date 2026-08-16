import { describe, it, expect } from "vitest";
import { formatPrice, guardLevelName } from "@/features/danmaku/format";

describe("guardLevelName 船型换算", () => {
  it("guard_level 3/2/1 → 舰长/提督/总督", () => {
    expect(guardLevelName(3)).toBe("舰长");
    expect(guardLevelName(2)).toBe("提督");
    expect(guardLevelName(1)).toBe("总督");
  });

  it("未知等级返回 null（由调用方回退上游名称）", () => {
    expect(guardLevelName(0)).toBeNull();
    expect(guardLevelName(9)).toBeNull();
  });
});

describe("formatPrice 金额换算（元）", () => {
  it("整数不带小数", () => {
    expect(formatPrice(30)).toBe("¥30");
    expect(formatPrice(0)).toBe("¥0");
  });

  it("小数至多两位", () => {
    expect(formatPrice(19.8)).toBe("¥19.8");
    expect(formatPrice(1380 / 1000)).toBe("¥1.38");
  });
});
