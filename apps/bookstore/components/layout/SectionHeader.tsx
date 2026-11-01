import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  as?: "h1" | "h2";
  eyebrow?: string;
  folio?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  className?: string;
}

/** 章节头：folio + eyebrow + 标题 + lead + actions + 1px 线。 */
export default function SectionHeader({
  as = "h2",
  eyebrow,
  folio,
  title,
  lead,
  actions,
  className,
}: SectionHeaderProps) {
  const Heading = as;
  return (
    <header className={cn("flex flex-col gap-2 border-b border-line pb-5", className)}>
      {(eyebrow || folio) && (
        <p className="flex items-baseline gap-3 font-mono text-label tracking-label uppercase text-ink-dim">
          {folio ? <span className="font-display text-h3 normal-case tracking-normal text-primary">{folio}</span> : null}
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading className="font-serif text-h2 font-semibold leading-tight text-ink">{title}</Heading>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {lead ? <p className="max-w-[38rem] text-body leading-loose text-ink-dim">{lead}</p> : null}
    </header>
  );
}
