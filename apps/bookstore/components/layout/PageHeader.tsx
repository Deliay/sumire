import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  eyebrow?: string;
  folio?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  className?: string;
}

/** 页面头：eyebrow + folio + h1 + lead + actions + 1px 线。 */
export default function PageHeader({ eyebrow, folio, title, lead, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 border-b border-line pb-8", className)}>
      {(eyebrow || folio) && (
        <p className="flex items-baseline gap-3 font-mono text-label tracking-label uppercase text-ink-dim">
          {folio ? <span className="font-display text-h3 normal-case tracking-normal text-primary">{folio}</span> : null}
          {eyebrow}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-h1 font-semibold leading-tight text-ink">{title}</h1>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {lead ? <p className="max-w-[38rem] font-serif text-body leading-loose text-ink-dim">{lead}</p> : null}
    </header>
  );
}
