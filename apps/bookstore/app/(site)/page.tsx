import Image from "next/image";
import Footer from "@/components/Footer";
import LiveStatus from "@/features/home/LiveStatus";
import TodaySchedule from "@/features/home/TodaySchedule";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { getAssetById, getProfile, getSite } from "@/lib/content";
import { assetThumbnailUrl } from "@/lib/content/shared";

export default function Home() {
  const profile = getProfile();
  const site = getSite();
  const heroAsset = getAssetById("standing-01");
  if (!heroAsset) throw new Error("missing asset: standing-01");

  return (
    <div className="relative flex h-svh flex-col overflow-hidden">
      {/* 雾气氛围 */}
      <div className="fog fog-a -left-40 top-1/4 size-[42rem] bg-flower/10" aria-hidden />
      <div className="fog fog-b -right-32 bottom-0 size-[36rem] bg-primary/10" aria-hidden />

      {/* 立绘：桌面右半宽 × 顶部起始 50% 高；移动端顶部 50% 全宽。作为衬底不参与布局流。 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 lg:left-auto lg:right-0 lg:h-1/2 lg:w-1/2">
        <Image
          src={assetThumbnailUrl(heroAsset)}
          alt={heroAsset.title}
          width={1000}
          height={2000}
          priority
          className="h-full w-full object-cover object-top"
        />
      </div>

      {/* 左列内容：flex 流式纵向排布，靠布局自然避让不遮挡 */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-5 p-5 lg:justify-end lg:gap-6 lg:p-10 lg:pr-[50%]">
        {/* 组件区：直播状态 + 今日日程，仅 API 配置时挂载 */}
        <div className="flex flex-col items-start gap-3">
          {API_CONFIGURED && <LiveStatus liveUrl={site.links.live} />}
          {API_CONFIGURED && <TodaySchedule />}
        </div>

        {/* 文案块 */}
        <div className="flex flex-col gap-3 lg:gap-4">
          <p
            className="animate-rise font-display text-sm italic tracking-[0.35em] text-ink-dim"
            style={{ animationDelay: "0ms" }}
          >
            VirtuaReal · 二十八期
          </p>
          <h1
            className="animate-rise flex flex-col gap-1"
            style={{ animationDelay: "120ms" }}
          >
            <span className="font-serif text-display font-bold tracking-wider">
              枝堇
            </span>
            <span className="font-display text-h1 italic text-primary">
              Sumire
            </span>
          </h1>
          <p
            className="animate-rise max-w-md leading-loose text-ink-dim"
            style={{ animationDelay: "240ms" }}
          >
            {profile.bio}
          </p>
        </div>
      </div>

      {/* Footer 行：右下角贴边单行 */}
      <div className="relative flex justify-end p-5 lg:p-10">
        <Footer site={site} floating />
      </div>
    </div>
  );
}
