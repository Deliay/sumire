"use client";

import { buildTree, activeNode } from "@/features/home/sectionRail";
import type { SectionDef } from "@/features/home/sections";
import { useMediaQuery } from "@/lib/useMediaQuery";

interface SectionRailProps {
  sections: SectionDef[];
  index: number;
  onNavigate: (index: number) => void;
}

/** 竖向树状位置指示器：模块 → 子内容，仅圆点节点（无文字），当前高亮、点击跳转、键盘可达。 */
export default function SectionRail({ sections, index, onNavigate }: SectionRailProps) {
  const isMobile = useMediaQuery("(max-width: 639px)");
  const tree = buildTree(sections);
  const active = activeNode(sections, index);

  const findIndex = (id: string): number => {
    const i = sections.findIndex((s) => s.id === id);
    return i >= 0 ? i : 0;
  };

  return (
    <nav
      aria-label="页面位置"
      className="fixed right-4 top-1/2 z-30 -translate-y-1/2"
    >
      <ol className="flex flex-col items-center gap-3 border-l border-vine/30 pl-3">
        {tree.map((node) => {
          const isActive = active === node.id;
          const isParentActive = node.id === "archive" && active.startsWith("archive");
          return (
            <li key={node.id} className="flex flex-col items-center gap-3">
              {node.children && !isMobile ? (
                <>
                  <a
                    href={node.hash}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(findIndex(node.children![0]!.id));
                    }}
                    aria-label={node.label}
                    aria-current={isParentActive ? "true" : undefined}
                    className="flex items-center"
                  >
                    <span
                      aria-hidden
                      className={`size-2 rounded-full transition-colors ${
                        isParentActive ? "bg-flower shadow-[0_0_8px_var(--color-flower)]" : "bg-vine"
                      }`}
                    />
                  </a>
                  <ul className="flex flex-col items-center gap-3 border-l border-vine/20 pl-2">
                    {node.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={child.hash}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate(findIndex(child.id));
                          }}
                          aria-label={child.label}
                          aria-current={active === child.id ? "true" : undefined}
                          className="flex items-center"
                        >
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full transition-colors ${
                              active === child.id
                                ? "bg-flower shadow-[0_0_6px_var(--color-flower)]"
                                : "bg-vine/50"
                            }`}
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <a
                  href={node.hash}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(findIndex(node.children ? node.children[0]!.id : node.id));
                  }}
                  aria-label={node.label}
                  aria-current={isActive ? "true" : undefined}
                  className="flex items-center"
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-full transition-colors ${
                      isActive ? "bg-flower shadow-[0_0_8px_var(--color-flower)]" : "bg-vine"
                    }`}
                  />
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}