import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** 统一空态：标题 + 说明 + 一个动作。 */
export default function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-2 rounded-xs border border-line p-6", className)}>
      <h3 className="font-serif text-h3 font-semibold text-ink">{title}</h3>
      {description ? <p className="text-small text-ink-dim">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
