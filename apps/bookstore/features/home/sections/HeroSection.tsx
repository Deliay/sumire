"use client";

import LiveStatus from "@/features/home/LiveStatus";
import TodaySchedule from "@/features/home/TodaySchedule";
import Plate from "@/components/ui/Plate";
import { API_CONFIGURED } from "@/features/backdoor/api";
import type { Asset, Profile, Site } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

/** 首页站：竖排书名 + 右侧图版 + 元数据行（无雾气 / 无粒子 / 无视差）。 */
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
    <section className="relative flex h-svh flex-col overflow-hidden max-lg:overflow-y-auto">
      {/* 一处静态径向微光（primary/6%，无动画） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60rem 40rem at 20% 30%, color-mix(in oklab, var(--color-primary) 6%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex h-full min-h-0 flex-col gap-6 px-5 pb-8 pt-24 max-lg:h-auto lg:grid lg:grid-cols-12 lg:items-end lg:gap-8 lg:px-16 lg:pb-16 lg:pt-28">
        {/* 图版：移动端在上（55svh），桌面右 6 列 */}
        <div className="order-first min-h-0 shrink-0 lg:order-none lg:col-span-6 lg:col-start-7 lg:row-start-1">
          <Plate
            src={assetOriginalWebpUrl(heroAsset)}
            alt={heroAsset.title}
            width={2000}
            height={4000}
            priority
            index={1}
            caption={`${heroAsset.title} · 立绘`}
            frameClassName="h-[55svh] lg:h-[68svh]"
            imageClassName="object-top"
            className="h-full"
          />
        </div>

        {/* 文字列：桌面左 5 列 */}
        <div className="flex min-h-0 flex-col justify-end gap-5 max-lg:shrink-0 lg:col-span-5 lg:col-start-1 lg:row-start-1">
          <p className="font-mono text-label tracking-label uppercase text-ink-dim">
            VirtuaReal · 二十八期
          </p>

          <h1 className="flex flex-wrap items-end gap-x-4">
            <span className="animate-enter font-serif text-display font-semibold leading-none tracking-[0.08em] lg:[writing-mode:vertical-rl]">
              枝堇
            </span>
            <span className="animate-enter font-display text-h1 italic text-primary">Sumire</span>
          </h1>

          <p className="max-w-[34rem] animate-enter font-serif leading-loose text-ink-dim">
            {profile.bio}
          </p>

          {API_CONFIGURED ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line pb-3 text-small">
              <LiveStatus liveUrl={site.links.live} />
              <span aria-hidden className="text-line-strong">
                /
              </span>
              <TodaySchedule />
            </div>
          ) : null}

          <p className="font-mono text-tiny text-ink-dim">{site.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
