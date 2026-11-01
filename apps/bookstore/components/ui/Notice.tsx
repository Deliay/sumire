import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "warning";

const TONE_LINE: Record<Tone, string> = {
  info: "border-l-primary",
  warning: "border-l-gold",
};

export interface NoticeProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** 页面级提示：左侧 2px 语义竖线 + raised 底。 */
export default function Notice({ tone = "info", title, children, className }: NoticeProps) {
  return (
    <div className={cn("rounded-xs border border-line border-l-2 bg-raised p-5", TONE_LINE[tone], className)}>
      {title ? <h3 className="font-serif text-h3 font-semibold text-ink">{title}</h3> : null}
      <div className={cn("text-small leading-relaxed text-ink-dim", title && "mt-1.5")}>{children}</div>
    </div>
  );
}
