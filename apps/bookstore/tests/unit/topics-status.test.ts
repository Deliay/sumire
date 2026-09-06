import { describe, expect, it } from "vitest";
import { getStatusText, getStatusBadgeClass } from "../../features/topics/status";

describe("getStatusText", () => {
  it("returns correct text for upcoming", () => {
    expect(getStatusText("upcoming")).toBe("未开始");
  });

  it("returns correct text for collecting", () => {
    expect(getStatusText("collecting")).toBe("进行中");
  });

  it("returns correct text for ended", () => {
    expect(getStatusText("ended")).toBe("已结束");
  });
});

describe("getStatusBadgeClass", () => {
  it("returns border-primary for upcoming", () => {
    expect(getStatusBadgeClass("upcoming")).toContain("border-primary");
  });

  it("returns border-flower for collecting", () => {
    expect(getStatusBadgeClass("collecting")).toContain("border-flower");
  });

  it("returns border-ink-dim for ended", () => {
    expect(getStatusBadgeClass("ended")).toContain("border-ink-dim");
  });
});
