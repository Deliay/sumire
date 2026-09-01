import type { ReactNode } from "react";

/** 章节标题（各部分共用）。 */
export function SectionTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="font-serif text-2xl font-semibold text-ink">{children}</h2>
      <span className="font-display text-sm italic tracking-widest text-ink-dim">
        {sub}
      </span>
    </div>
  );
}