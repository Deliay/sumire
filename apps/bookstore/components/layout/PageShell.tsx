import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Width = "wide" | "prose";

const WIDTHS: Record<Width, string> = {
  wide: "max-w-[88rem]",
  prose: "max-w-[44rem]",
};

export interface PageShellProps {
  width?: Width;
  /** 是否包含固定导航留白（默认 true）。 */
  withNavOffset?: boolean;
  className?: string;
  children: ReactNode;
}

/** 公开页统一版心：gutter、宽/阅读版心与桌面装订线。 */
export default function PageShell({
  width = "prose",
  withNavOffset = true,
  className,
  children,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-16",
        WIDTHS[width],
        withNavOffset ? "pt-24 lg:pt-32" : "pt-12 lg:pt-16",
        "pb-24 lg:pb-32",
        "lg:border-l lg:border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}
