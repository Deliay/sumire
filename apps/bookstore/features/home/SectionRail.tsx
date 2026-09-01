"use client";

import { buildTree, activeNode } from "@/features/home/sectionRail";
import type { SectionDef } from "@/features/home/sections";
import { useMediaQuery } from "@/lib/useMediaQuery";

interface SectionRailProps {
  sections: SectionDef[];
  index: number;
  onNavigate: (index: number) => void;
}

/** 竖向树状位置指示器：模块 → 子内容，当前高亮、点击跳转、键盘可达。 */
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
      <ol className="flex flex-col gap-1 border-l border-vine/30 pl-3">
        {tree.map((node) => {
          const isActive = active === node.id;
          const isParentActive = node.id === "archive" && active.startsWith("archive");
          return (
            <li key={node.id}>
              {node.children && !isMobile ? (
                <>
                  <a
                    href={node.hash}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(findIndex(node.children![0]!.id));
                    }}
                    aria-current={isParentActive ? "true" : undefined}
                    className={`flex items-center gap-2 text-xs tracking-widest transition-colors ${
                      isParentActive ? "text-flower" : "text-ink-dim hover:text-ink"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`size-2 rounded-full ${
                        isParentActive ? "bg-flower shadow-[0_0_8px_var(--color-flower)]" : "bg-vine"
                      }`}
                    />
                    档案
                  </a>
                  <ul className="ml-4 mt-1 flex flex-col gap-1 border-l border-vine/20 pl-2">
                    {node.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={child.hash}
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate(findIndex(child.id));
                          }}
                          aria-current={active === child.id ? "true" : undefined}
                          className={`flex items-center gap-1.5 text-[11px] tracking-wider transition-colors ${
                            active === child.id
                              ? "text-flower"
                              : "text-ink-dim/80 hover:text-ink"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`size-1.5 rounded-full ${
                              active === child.id
                                ? "bg-flower shadow-[0_0_6px_var(--color-flower)]"
                                : "bg-vine/50"
                            }`}
                          />
                          {child.label}
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
                  aria-current={isActive ? "true" : undefined}
                  className={`flex items-center gap-2 text-xs tracking-widest transition-colors ${
                    isActive ? "text-flower" : "text-ink-dim hover:text-ink"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${
                      isActive ? "bg-flower shadow-[0_0_8px_var(--color-flower)]" : "bg-vine"
                    }`}
                  />
                  {node.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}