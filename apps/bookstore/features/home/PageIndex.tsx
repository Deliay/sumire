"use client";

import type { MouseEvent } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/cn";
import { activeEntry, indexEntries } from "@/features/home/pageIndex";
import type { SectionDef } from "@/features/home/sections";

export interface PageIndexProps {
  sections: SectionDef[];
  index: number;
  onNavigate: (index: number) => void;
}

/** 右侧页码索引：中文页码，当前项显示 16px 横线 + 标签；<1024px 隐藏。 */
export default function PageIndex({ sections, index, onNavigate }: PageIndexProps) {
  const compact = useMediaQuery("(max-width: 1023px)");
  if (compact) return null;

  const entries = indexEntries(sections);
  const current = activeEntry(sections, index);

  return (
    <nav
      aria-label="页面位置"
      className="fixed right-6 top-1/2 z-30 -translate-y-1/2"
    >
      <ol className="flex flex-col items-end gap-1">
        {entries.map((entry, i) => {
          const isCurrent = entry.id === current;
          return (
            <li key={entry.id}>
              <a
                href={entry.hash}
                aria-label={entry.label}
                aria-current={isCurrent ? "true" : undefined}
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  onNavigate(i);
                }}
                className={cn(
                  "group flex min-h-11 items-center justify-end gap-2 pl-2 text-right font-mono text-label transition-colors duration-(--duration-fast)",
                  isCurrent ? "text-primary" : "text-ink-dim hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "transition-opacity duration-(--duration-fast)",
                    isCurrent
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                  )}
                >
                  {entry.label}
                </span>
                {isCurrent ? <span aria-hidden className="h-px w-4 bg-primary" /> : null}
                <span className={cn(isCurrent ? "text-primary" : "opacity-100")}>{entry.folio}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
