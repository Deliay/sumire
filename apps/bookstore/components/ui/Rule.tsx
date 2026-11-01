import { cn } from "@/lib/cn";

export interface RuleProps {
  label?: string;
  className?: string;
}

/** 1px 结构线，可带左端 mono 标签。 */
export default function Rule({ label, className }: RuleProps) {
  if (!label) return <div aria-hidden className={cn("h-px w-full bg-line", className)} />;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="shrink-0 font-mono text-label tracking-label uppercase text-ink-dim">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}
