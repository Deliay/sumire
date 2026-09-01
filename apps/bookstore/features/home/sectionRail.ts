import type { SectionDef, SectionId } from "@/features/home/sections";

/** 指示器树节点：主节点（模块）或含子节点的档案。 */
export interface RailNode {
  /** 节点 id（主节点为 navKey，子节点为站 id）。 */
  id: SectionId | "home" | "calendar" | "assets" | "archive";
  label: string;
  /** 该节点首个站的锚点 hash。 */
  hash: string;
  /** 子节点（仅档案）。 */
  children?: RailNode[];
}

/**
 * 构建模块 → 子内容两层树（档案 5 站挂档案模块下，其余为主节点）。
 */
export function buildTree(sections: SectionDef[]): RailNode[] {
  const archiveKids = sections.filter((s) => s.parent === "archive");
  // 全量站序，随后将档案子站折叠为单一主节点（保留首个出现位置）
  const order: SectionId[] = sections.map((s) => s.id);
  const archiveIdx = archiveKids.length > 0 ? order.findIndex((id) => id === archiveKids[0]!.id) : -1;
  if (archiveIdx >= 0) {
    const top = order.filter((id) => !archiveKids.some((k) => k.id === id));
    top.splice(archiveIdx, 0, "archive" as SectionId);
    order.length = 0;
    order.push(...top);
  }

  const nodes: RailNode[] = [];
  for (const id of order) {
    const isArchive = id === ("archive" as SectionId);
    const def = sections.find((s) => s.id === id);
    const label = isArchive ? "档案" : (def?.title ?? "");
    const node: RailNode = {
      id: isArchive ? "archive" : (def?.navKey ?? id),
      label,
      hash: isArchive ? (archiveKids[0]?.hash ?? "") : (def?.hash ?? ""),
    };
    if (isArchive && archiveKids.length > 0) {
      node.children = archiveKids.map((s) => ({
        id: s.id,
        label: s.title,
        hash: s.hash,
      }));
    }
    nodes.push(node);
  }
  return nodes;
}

/**
 * 站索引 → 当前高亮节点 id。档案站精确到子节点，其余映射主节点。
 */
export function activeNode(sections: SectionDef[], index: number): RailNode["id"] {
  const s = sections[index];
  if (!s) return "home";
  if (s.parent === "archive") return s.id as SectionId;
  return s.navKey;
}