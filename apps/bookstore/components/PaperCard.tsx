import type { ReactNode } from "react";

interface PaperCardProps {
  children: ReactNode;
  className?: string;
  /** 四角藤蔓角饰 */
  corners?: boolean;
}

function Corner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className={`absolute size-8 text-vine ${className}`}
    >
      <path
        d="M38 2 Q 20 4, 14 14 T 4 38"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="16" cy="16" r="2.2" fill="var(--color-flower)" />
    </svg>
  );
}

/**
 * 纸页卡片：旧纸张质感的长文阅读面（浅色），与整站的夜底形成对比。
 */
export default function PaperCard({
  children,
  className = "",
  corners = true,
}: PaperCardProps) {
  return (
    <div
      className={`paper relative rounded-md p-6 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.6)] sm:p-10 ${className}`}
    >
      {corners && (
        <>
          <Corner className="left-1.5 top-1.5 -scale-x-100" />
          <Corner className="right-1.5 top-1.5" />
          <Corner className="bottom-1.5 left-1.5 -scale-x-100 -scale-y-100" />
          <Corner className="bottom-1.5 right-1.5 -scale-y-100" />
        </>
      )}
      {children}
    </div>
  );
}
