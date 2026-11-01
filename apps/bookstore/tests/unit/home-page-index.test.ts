import { describe, it, expect } from "vitest";
import { activeEntry, indexEntries, FOLIOS } from "@/features/home/pageIndex";
import { visibleSections } from "@/features/home/sections";

const sections8 = visibleSections(true);
const sections7 = visibleSections(false);

describe("indexEntries", () => {
  it("8 站 folio 连续（壹~捌）", () => {
    const entries = indexEntries(sections8);
    expect(entries).toHaveLength(8);
    expect(entries.map((e) => e.folio)).toEqual([...FOLIOS]);
    expect(entries.map((e) => e.id)).toEqual([
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

  it("7 站（无日历）folio 不跳号", () => {
    const entries = indexEntries(sections7);
    expect(entries).toHaveLength(7);
    expect(entries.map((e) => e.folio)).toEqual(["壹", "贰", "叁", "肆", "伍", "陆", "柒"]);
    expect(entries.map((e) => e.id)).not.toContain("calendar");
    expect(entries.at(-1)!.id).toBe("assets");
  });

  it("标签拼接：archive-* 用「档案 · X」，其余用 railLabel", () => {
    const entries = indexEntries(sections8);
    expect(entries[0]!.label).toBe("首页");
    expect(entries[1]!.label).toBe("档案 · 信息");
    expect(entries[1]!.isArchiveChild).toBe(true);
    expect(entries[7]!.label).toBe("素材");
  });

  it("hash 与 sections 同源", () => {
    const entries = indexEntries(sections8);
    expect(entries[0]!.hash).toBe("#hero");
    expect(entries[7]!.hash).toBe("#assets");
  });
});

describe("activeEntry", () => {
  it("返回当前条目 id", () => {
    expect(activeEntry(sections8, 0)).toBe("hero");
    expect(activeEntry(sections8, 3)).toBe("archive-3");
    expect(activeEntry(sections8, 7)).toBe("assets");
  });

  it("越界回落首页", () => {
    expect(activeEntry(sections8, -1)).toBe("hero");
    expect(activeEntry(sections8, 99)).toBe("hero");
  });
});
