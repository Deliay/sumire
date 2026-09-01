import Image from "next/image";
import type { Asset } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

interface SplitSectionProps {
  /** 立绘素材。 */
  portrait: Asset;
  /** 单数屏立绘在左（true），双数屏立绘在右（false）。 */
  portraitLeft: boolean;
  /** 内容（右侧/左侧信息区）。 */
  children: React.ReactNode;
}

/**
 * 档案立绘分栏布局（可复用）：桌面 grid 左右分栏——单数屏立绘在左、双数屏立绘在右，
 * 移动端立绘在上、内容在下（内容列可滚动兜底）。不约束整屏高度（流式页 / 整页站均可用）。
 */
export default function SplitSection({ portrait, portraitLeft, children }: SplitSectionProps) {
  const artwork = (
    <div className="pointer-events-none relative h-full min-h-0 overflow-hidden">
      <Image
        src={assetOriginalWebpUrl(portrait)}
        alt={portrait.title}
        width={1000}
        height={2000}
        // 首页式裁剪呈现：object-cover object-top 只露上半身，作氛围衬底而非全身像
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {/* 移动端立绘在上、内容在下；桌面单数屏立绘左双数屏立绘右；桌面立绘列约束在屏高内完整显示 */}
      <div className={`order-1 h-[40svh] min-h-0 lg:h-full ${portraitLeft ? "lg:order-1" : "lg:order-2"}`}>
        {artwork}
      </div>
      <div
        data-fullpage-scrollable
        className={`order-2 flex min-h-0 items-center overflow-y-auto lg:justify-center lg:overflow-visible ${
          portraitLeft ? "lg:order-2" : "lg:order-1"
        }`}
      >
        {children}
      </div>
    </div>
  );
}