import Image from "next/image";
import Footer from "@/components/Footer";
import LiveStatus from "@/features/home/LiveStatus";
import TodaySchedule from "@/features/home/TodaySchedule";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { getAssetById, getProfile, getSite } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

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

      {/* 立绘：移动端顶部 10% 起 90% 高全宽并向右偏移 25% 宽；桌面端右 10% 起 90% 高右半宽、不偏移。作为衬底不参与布局流。 */}
      <div className="pointer-events-none absolute inset-x-0 top-[10%] h-[90%] lg:left-auto lg:right-[10%] lg:w-1/2">
        <Image
          src={assetOriginalWebpUrl(heroAsset)}
          alt={heroAsset.title}
          width={2000}
          height={4000}
          priority
          className="ml-[25%] h-full w-full object-cover object-top lg:ml-0"
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

      {/* Footer 行：通栏贴底毛玻璃条，占满宽度且左/右/下三边齐平贴到视口边缘；内边距见 Footer floating 内层容器 */}
      <div className="relative shrink-0">
        <Footer site={site} floating />
      </div>
    </div>
  );
}
