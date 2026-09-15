"use client";

import { JourneyPart, ProfilePart, SplitSection, StoryPart, TastePart, TriviaPart } from "@/features/about/parts";
import { ARCHIVE_TITLES } from "@/features/home/sections";
import type { Asset, Profile } from "@/lib/content";

/**
 * 档案各屏立绘选取（仅立绘 standing，按「持书/非持书」错位语义：奇数屏非持书、偶数屏持书，
 * 避开首页/信息卡同款持书立绘 standing-01）：P1→standing-02、P2→standing-01、P3→standing-02、P4→standing-01、P5→standing-02。
 * 桌面错位立绘与移动端 hero 口径背景立绘共用同一 cycle（P1/P3/P5→standing-02、P2/P4→standing-01）。
 */
const STANDING_CYCLE = [1, 0, 1, 0, 1] as const;

export default function ArchiveSection({
  part,
  profile,
  portraitAssets,
}: {
  part: number;
  profile: Profile;
  portraitAssets: Asset[];
}) {
  const title = ARCHIVE_TITLES[part - 1]?.title ?? "";
  // 仅取立绘（standing）类素材，按「持书/非持书」错位映射选取；立绘不足时回退循环
  const standings = portraitAssets.filter((a) => a.category === "standing");
  const portrait =
    standings.length > 0
      ? standings[STANDING_CYCLE[(part - 1) % STANDING_CYCLE.length] % standings.length]
      : portraitAssets[(part - 1) % portraitAssets.length];
  // P1 大屏立绘与 ProfilePart 内立绘不同源：ProfilePart 用 standing-02（与 /about 一致），避免同图并排
  const profilePortrait = portraitAssets.find((a) => a.id === "standing-02") ?? portrait;
  // 移动端 hero 口径背景立绘：按与桌面错位一致的 cycle 交替（P1/P3/P5→standing-02、P2/P4→standing-01，
  // 全宽、顶部 10% 起占 90% 高、右偏 25%）
  const mobilePortrait =
    standings.length > 0
      ? standings[STANDING_CYCLE[(part - 1) % STANDING_CYCLE.length] % standings.length]
      : portrait;
  const portraitLeft = part % 2 === 1;

  const content = (
    <div className="flex min-h-0 flex-col justify-center gap-4 lg:gap-5">
      {part === 1 && (
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      )}
      {part === 1 && <ProfilePart profile={profile} portrait={profilePortrait} variant="bare" />}
      {part === 2 && <StoryPart profile={profile} />}
      {part === 3 && <TastePart profile={profile} />}
      {part === 4 && <JourneyPart profile={profile} />}
      {part === 5 && <TriviaPart profile={profile} />}
    </div>
  );

  return (
    <section className="relative flex h-svh flex-col overflow-hidden lg:px-10">
      {/* 无纵向 padding：立绘列随 grid h-full 出血至窗口底边；内容呼吸间距由内容区自身 padding 承担
          （移动端零横向 padding，hero 口径背景立绘全宽出血；桌面 lg:px-10 约束分栏） */}
      <SplitSection portrait={portrait} portraitLeft={portraitLeft} heroMobilePortrait={mobilePortrait} anchorContentBottom>
        <div className="w-full pb-6 lg:py-10">{content}</div>
      </SplitSection>
    </section>
  );
}