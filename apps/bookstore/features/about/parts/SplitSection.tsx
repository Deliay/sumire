"use client";

import { useEffect, useRef } from "react";
import Plate from "@/components/ui/Plate";
import type { Asset } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

interface SplitSectionProps {
  /** 立绘素材。 */
  portrait: Asset;
  /**
   * 内容列溢出时初始滚动锚定到底部（首页 deck 档案各屏用：桌面端内容超一屏时默认可见最新条目）。
   * /about 流式页不传（高度自适应，无滚动）。
   */
  anchorContentBottom?: boolean;
  /** 内容（左侧文字列）。 */
  children: React.ReactNode;
}

/**
 * 档案分栏布局：固定阅读轴——桌面文字左 6 列、图版右 5 列（偏移 1 列）；
 * 移动端图版在上（40svh）、文字在下。不约束整屏高度。
 */
export default function SplitSection({ portrait, anchorContentBottom, children }: SplitSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchorContentBottom) return;
    const el = contentRef.current;
    if (!el) return;
    let active = true;
    const anchor = () => {
      if (!active) return;
      if (typeof window === "undefined" || window.innerWidth < 1024) return;
      if (el.scrollHeight > el.clientHeight + 1) el.scrollTop = el.scrollHeight;
    };
    anchor();
    let raf = 0;
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(anchor);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(anchor).catch(() => {});
    }
    window.addEventListener("resize", anchor);
    return () => {
      active = false;
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      window.removeEventListener("resize", anchor);
    };
  }, [anchorContentBottom]);

  return (
    <div className="relative h-full min-h-0">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-8">
        <div
          ref={contentRef}
          data-fullpage-scrollable
          className="order-2 flex min-h-0 items-center overflow-y-auto lg:order-none lg:col-span-6 lg:row-start-1"
        >
          <div className="w-full lg:py-10">{children}</div>
        </div>
        <div className="order-1 min-h-0 lg:order-none lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-center">
          <Plate
            src={assetOriginalWebpUrl(portrait)}
            alt={portrait.title}
            width={1000}
            height={2000}
            fit="cover"
            frameClassName="h-[40svh] lg:h-[70svh]"
            imageClassName="object-top"
            caption={`${portrait.title} · 立绘`}
          />
        </div>
      </div>
    </div>
  );
}
