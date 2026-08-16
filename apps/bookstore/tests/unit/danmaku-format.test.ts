import { describe, it, expect } from "vitest";
import {
  formatPrice,
  giftPriceTone,
  guardBadgeAsset,
  guardLevelName,
  guardLevelTone,
} from "@/features/danmaku/format";

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

describe("guardLevelTone 船型着色", () => {
  it("3 舰长蓝（eye）/2 提督紫（flower）/1 总督红（crimson），含条目打底色", () => {
    expect(guardLevelTone(3)).toEqual({ bar: "bg-eye/70", chip: "bg-eye/25", text: "text-eye", item: "bg-eye/10" });
    expect(guardLevelTone(2)).toEqual({ bar: "bg-flower/70", chip: "bg-flower/30", text: "text-flower", item: "bg-flower/10" });
    expect(guardLevelTone(1)).toEqual({ bar: "bg-crimson/70", chip: "bg-crimson/25", text: "text-crimson", item: "bg-crimson/10" });
  });

  it("未知等级回退紫色（flower）", () => {
    expect(guardLevelTone(0)).toEqual({ bar: "bg-flower/70", chip: "bg-flower/30", text: "text-flower", item: "bg-flower/10" });
  });
});

describe("guardBadgeAsset 头像上船挂件", () => {
  it("3/2/1 → 舰长/提督/总督本地素材路径", () => {
    expect(guardBadgeAsset(3)).toBe("/assets/original/guard-badge-captain.png");
    expect(guardBadgeAsset(2)).toBe("/assets/original/guard-badge-admiral.png");
    expect(guardBadgeAsset(1)).toBe("/assets/original/guard-badge-governor.png");
  });

  it("未知/空等级返回 null（不渲染挂件）", () => {
    expect(guardBadgeAsset(0)).toBeNull();
    expect(guardBadgeAsset(9)).toBeNull();
  });
});

describe("giftPriceTone 礼物价值分级", () => {
  it("<10 灰，10-99 蓝，100-500 金，>500 红", () => {
    expect(giftPriceTone(1)).toBe("text-ink-dim");
    expect(giftPriceTone(9.9)).toBe("text-ink-dim");
    expect(giftPriceTone(10)).toBe("text-eye");
    expect(giftPriceTone(99)).toBe("text-eye");
    expect(giftPriceTone(100)).toBe("text-gold");
    expect(giftPriceTone(500)).toBe("text-gold");
    expect(giftPriceTone(501)).toBe("text-crimson");
  });
});
