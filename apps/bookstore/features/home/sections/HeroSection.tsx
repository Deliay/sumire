"use client";

import Image from "next/image";
import LiveStatus from "@/features/home/LiveStatus";
import TodaySchedule from "@/features/home/TodaySchedule";
import ParallaxLayer from "@/features/home/ParallaxLayer";
import { API_CONFIGURED } from "@/features/backdoor/api";
import type { Asset, Profile, Site } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

/** 首页站：雾气 + 光晕粒子 + 立绘视差 + 文案块（无 Footer floating，改小号免责声明行）。 */
export default function HeroSection({
  profile,
  site,
  heroAsset,
}: {
  profile: Profile;
  site: Site;
  heroAsset: Asset;
}) {
  return (
    <section className="relative flex h-svh flex-col overflow-hidden">
      {/* 雾气氛围 */}
      <div className="fog fog-a -left-40 top-1/4 size-[42rem] bg-flower/10" aria-hidden />
      <div className="fog fog-b -right-32 bottom-0 size-[36rem] bg-primary/10" aria-hidden />

      {/* 立绘视差衬底：四周外扩 PARALLAX_MAX(12px) 余量，视差最大位移时底/顶/左右边仍被 section overflow-hidden 覆盖，不露截断边 */}
      <ParallaxLayer className="pointer-events-none absolute -inset-x-3 top-[10%] -bottom-3 lg:left-auto lg:right-[10%] lg:w-1/2">
        <Image
          src={assetOriginalWebpUrl(heroAsset)}
          alt={heroAsset.title}
          width={2000}
          height={4000}
          priority
          className="ml-[25%] h-full w-full object-cover object-top lg:ml-0"
        />
      </ParallaxLayer>

      {/* 左列内容 */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-end gap-5 p-5 lg:justify-end lg:gap-6 lg:p-10 lg:pr-[50%]">
        <div className="flex flex-col items-start gap-3">
          {API_CONFIGURED && <LiveStatus liveUrl={site.links.live} />}
          {API_CONFIGURED && <TodaySchedule />}
        </div>

        <div className="flex flex-col gap-3 lg:gap-4">
          <p
            className="animate-rise font-display text-sm italic tracking-[0.35em] text-ink-dim"
            style={{ animationDelay: "0ms" }}
          >
            VirtuaReal · 二十八期
          </p>
          <h1 className="animate-rise flex flex-col gap-1" style={{ animationDelay: "120ms" }}>
            <span className="font-serif text-display font-bold tracking-wider">枝堇</span>
            <span className="font-display text-h1 italic text-primary">Sumire</span>
          </h1>
          <p
            className="animate-rise max-w-md leading-loose text-ink-dim"
            style={{ animationDelay: "240ms" }}
          >
            {profile.bio}
          </p>
          <p className="mt-2 font-display text-xs italic tracking-widest text-ink-dim/70">
            {site.disclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}