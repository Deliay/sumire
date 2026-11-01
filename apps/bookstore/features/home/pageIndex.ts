import type { SectionDef } from "@/features/home/sections";

/** 中文页码（按渲染顺序，不跳号）。 */
export const FOLIOS = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌"] as const;

export interface IndexEntry {
  id: string;
  folio: string;
  label: string;
  hash: string;
  isArchiveChild: boolean;
}

/** 站序列 → 扁平页码索引（顺序即页码）。 */
export function indexEntries(sections: SectionDef[]): IndexEntry[] {
  return sections.map((section, index) => ({
    id: section.id,
    folio: FOLIOS[index] ?? String(index + 1),
    label:
      section.parent === "archive"
        ? `档案 · ${section.railLabel}`
        : (section.railLabel ?? section.title),
    hash: section.hash,
    isArchiveChild: section.parent === "archive",
  }));
}

/** 站索引 → 当前条目 id（越界回落首页）。 */
export function activeEntry(sections: SectionDef[], index: number): string {
  return sections[index]?.id ?? sections[0]?.id ?? "hero";
}
