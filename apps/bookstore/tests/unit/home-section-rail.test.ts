import { describe, it, expect } from "vitest";
import { buildTree, activeNode } from "@/features/home/sectionRail";
import { visibleSections } from "@/features/home/sections";

const sections8 = visibleSections(true);

describe("buildTree", () => {
  it("构建模块 → 子内容两层（档案 5 站挂档案模块下）", () => {
    const tree = buildTree(sections8);
    const archive = tree.find((n) => n.id === "archive");
    expect(archive).toBeTruthy();
    expect(archive!.children?.map((c) => c.id)).toEqual([
      "archive-1",
      "archive-2",
      "archive-3",
      "archive-4",
      "archive-5",
    ]);
    expect(tree.map((n) => n.id)).toEqual(["home", "archive", "calendar", "assets"]);
  });

  it("首页/日历/素材为主节点无子节点", () => {
    const tree = buildTree(sections8);
    const leaf = tree.find((n) => n.id === "home")!;
    const cal = tree.find((n) => n.id === "calendar")!;
    const assets = tree.find((n) => n.id === "assets")!;
    expect(leaf.children).toBeUndefined();
    expect(cal.children).toBeUndefined();
    expect(assets.children).toBeUndefined();
  });

  it("日历缺席时树收敛为 首页/档案×5/素材", () => {
    const tree = buildTree(visibleSections(false));
    expect(tree.map((n) => n.id)).toEqual(["home", "archive", "assets"]);
    expect(tree.find((n) => n.id === "archive")!.children).toHaveLength(5);
  });
});

describe("activeNode", () => {
  it("档案各站映射对应子节点", () => {
    // sections8 索引：hero0, archive-1..5 (1-5), calendar6, assets7
    expect(activeNode(sections8, 1)).toBe("archive-1");
    expect(activeNode(sections8, 3)).toBe("archive-3");
    expect(activeNode(sections8, 5)).toBe("archive-5");
  });

  it("非档案站映射主节点", () => {
    expect(activeNode(sections8, 0)).toBe("home");
    expect(activeNode(sections8, 6)).toBe("calendar");
    expect(activeNode(sections8, 7)).toBe("assets");
  });
});