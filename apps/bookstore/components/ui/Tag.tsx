import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type TagAs = "span" | "button";

export interface TagProps {
  as?: TagAs;
  children: ReactNode;
  className?: string;
}

const BASE =
  "inline-flex min-h-9 items-center rounded-sm border border-line px-3 font-sans text-small " +
  "text-ink-dim transition-colors duration-(--duration-fast) sm:min-h-[30px]";

/** 方形标签：静态 span 与可交互 button 视觉同源，hover 只在 button 上生效。 */
export default function Tag({ as = "span", children, className, ...rest }: TagProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  if (as === "button") {
    return (
      <button type="button" {...rest} className={cn(BASE, "hover:bg-soft hover:text-ink", className)}>
        {children}
      </button>
    );
  }
  return <span className={cn(BASE, className)}>{children}</span>;
}
