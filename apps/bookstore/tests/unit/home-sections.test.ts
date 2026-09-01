import { describe, it, expect } from "vitest";
import { SECTIONS, visibleSections } from "@/features/home/sections";

describe("sections 站序列注册表", () => {
  it("SECTIONS 共 8 站且顺序正确（hero → archive-1..5 → calendar → assets）", () => {
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "hero",
      "archive-1",
      "archive-2",
      "archive-3",
      "archive-4",
      "archive-5",
      "calendar",
      "assets",
    ]);
  });

  it("档案 5 站 parent 均为 archive、hash 与 id 一致、title 文案正确", () => {
    const archives = SECTIONS.filter((s) => s.id.startsWith("archive"));
    expect(archives).toHaveLength(5);
    for (const s of archives) {
      expect(s.parent).toBe("archive");
      expect(s.hash).toBe(`#${s.id}`);
    }
    expect(archives.map((s) => s.title)).toEqual([
      "信息 · Profile",
      "设定 · Story",
      "喜好 · Taste",
      "历程 · Journey",
      "轶闻 · Trivia",
    ]);
  });

  it("各站 navKey 归属正确", () => {
    expect(SECTIONS.find((s) => s.id === "hero")?.navKey).toBe("home");
    expect(SECTIONS.find((s) => s.id === "archive-3")?.navKey).toBe("archive");
    expect(SECTIONS.find((s) => s.id === "calendar")?.navKey).toBe("calendar");
    expect(SECTIONS.find((s) => s.id === "assets")?.navKey).toBe("assets");
  });

  it("visibleSections(true) 返回完整 8 站", () => {
    expect(visibleSections(true)).toHaveLength(8);
  });

  it("visibleSections(false) 过滤日历站，收敛为 7 站且 navKey 集合完整", () => {
    const sections = visibleSections(false);
    expect(sections.map((s) => s.id)).toEqual([
      "hero",
      "archive-1",
      "archive-2",
      "archive-3",
      "archive-4",
      "archive-5",
      "assets",
    ]);
    const navKeys = new Set(sections.map((s) => s.navKey));
    expect(navKeys.has("calendar")).toBe(false);
    expect(navKeys.has("home")).toBe(true);
    expect(navKeys.has("archive")).toBe(true);
    expect(navKeys.has("assets")).toBe(true);
  });
});