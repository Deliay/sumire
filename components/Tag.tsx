import type { ReactNode } from "react";

/**
 * 胶囊标签：藤蔓色细描边，hover 填充软面。
 */
export default function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-vine px-3.5 py-1 text-sm text-ink-dim transition-colors hover:bg-soft hover:text-ink">
      {children}
    </span>
  );
}
