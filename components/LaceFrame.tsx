import type { ReactNode } from "react";

/**
 * 蕾丝边框容器：上下各一条扇贝蕾丝纹。
 */
export default function LaceFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="lace-x" aria-hidden />
      <div className="py-6">{children}</div>
      <div className="lace-x -scale-y-100" aria-hidden />
    </div>
  );
}
