import Image from "next/image";
import ParallaxLayer from "@/features/home/ParallaxLayer";
import type { Asset } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

interface SplitSectionProps {
  /** 立绘素材。 */
  portrait: Asset;
  /** 单数屏立绘在左（true），双数屏立绘在右（false）。 */
  portraitLeft: boolean;
  /**
   * 移动端首页 hero 口径立绘（standing-01：全宽、顶部 10% 起占 90% 高、右偏 25% 裁剪、外包视差）。
   * 传入时移动端改为该背景立绘 + 内容浮层，桌面分栏不变；不传则维持移动端立绘在上、内容在下。
   */
  heroMobilePortrait?: Asset;
  /** 内容（右侧/左侧信息区）。 */
  children: React.ReactNode;
}

/**
 * 档案立绘分栏布局（可复用）：桌面 grid 左右分栏——单数屏立绘在左、双数屏立绘在右，
 * 移动端默认立绘在上、内容在下（内容列可滚动兜底）；传入 heroMobilePortrait 时移动端按首页 hero
 * 口径放置（全宽背景立绘 + 内容浮层）。不约束整屏高度（流式页 / 整页站均可用）。
 * 立绘列以 object-cover object-top 裁剪呈现、作氛围衬底不展示全身像；外包 ParallaxLayer 接视差
 * （pointermove + 传感器双输入、rAF 插值，与首屏口径一致，公开站氛围层不降级 reduced-motion）。
 */
export default function SplitSection({ portrait, portraitLeft, heroMobilePortrait, children }: SplitSectionProps) {
  return (
    <div className="relative h-full min-h-0">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
        {/* 移动端立绘在上、内容在下；桌面单数屏立绘左双数屏立绘右；桌面立绘列约束在屏高内完整显示 */}
        <div
          className={`min-h-0 lg:h-full ${
            heroMobilePortrait ? "hidden lg:block" : "order-1 h-[40svh]"
          } ${portraitLeft ? "lg:order-1" : "lg:order-2"}`}
        >
          <div className="pointer-events-none relative h-full w-full overflow-hidden">
            {/* 立绘较容器四周各外扩 PARALLAX_MAX（12px）余量：视差最大位移时底/顶/左右边仍被 overflow-hidden 覆盖，不露截断边 */}
            <ParallaxLayer className="absolute -inset-y-3 -inset-x-3">
              <Image
                src={assetOriginalWebpUrl(portrait)}
                alt={portrait.title}
                width={1000}
                height={2000}
                className="h-full w-full object-cover object-top"
              />
            </ParallaxLayer>
          </div>
        </div>
        <div
          data-fullpage-scrollable
          className={`flex min-h-0 items-center-safe overflow-y-auto lg:justify-center lg:overflow-visible ${
            heroMobilePortrait ? "relative z-10" : "order-2"
          } ${portraitLeft ? "lg:order-2" : "lg:order-1"}`}
        >
          {/* 移动端内容浮层：毛玻璃底铺满整屏（min-h-full ≥ 列高），增强与背景立绘的对比度；桌面（lg）不加底，维持既有分栏观感 */}
          <div
            className={`w-full ${
              heroMobilePortrait
                ? "min-h-full bg-night/70 px-5 py-6 backdrop-blur-md lg:min-h-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
                : ""
            }`}
          >
            {children}
          </div>
        </div>
      </div>
      {/* 移动端首页 hero 口径立绘背景：standing-01 全宽、顶部 10% 起占 90% 高、右偏 25% 裁剪，四周 12px 出血 */}
      {heroMobilePortrait && (
        <ParallaxLayer className="pointer-events-none absolute -inset-x-3 top-[10%] -bottom-3 lg:hidden">
          <Image
            src={assetOriginalWebpUrl(heroMobilePortrait)}
            alt={heroMobilePortrait.title}
            width={2000}
            height={4000}
            className="ml-[25%] h-full w-full object-cover object-top"
          />
        </ParallaxLayer>
      )}
    </div>
  );
}