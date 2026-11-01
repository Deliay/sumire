import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "raised" | "outline" | "paper";
type Padding = "none" | "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  raised: "border border-line bg-raised text-ink",
  outline: "border border-line bg-transparent text-ink",
  paper: "border border-paper-dim bg-paper text-ink-on-paper",
};

const PADDINGS: Record<Padding, string> = {
  none: "",
  sm: "p-5",
  md: "p-6",
  lg: "p-8",
};

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  className?: string;
  children: ReactNode;
}

/** 面板：raised / outline / paper，2px 圆角、无阴影。 */
export default function Surface({
  variant = "raised",
  padding = "md",
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <div {...rest} className={cn("rounded-xs", VARIANTS[variant], PADDINGS[padding], className)}>
      {children}
    </div>
  );
}
