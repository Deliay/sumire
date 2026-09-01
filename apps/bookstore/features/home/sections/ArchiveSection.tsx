"use client";

import { JourneyPart, ProfilePart, SplitSection, StoryPart, TastePart, TriviaPart } from "@/features/about/parts";
import { ARCHIVE_TITLES } from "@/features/home/sections";
import type { Asset, Profile } from "@/lib/content";

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
  const portrait = portraitAssets[(part - 1) % portraitAssets.length];
  // P1 大屏立绘与 ProfilePart 内立绘不同源：ProfilePart 用 standing-02（与 /about 一致），避免同图并排
  const profilePortrait = portraitAssets.find((a) => a.id === "standing-02") ?? portrait;
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
    <section className="relative flex h-svh flex-col overflow-hidden px-5 lg:px-10">
      {/* 无纵向 padding：立绘列随 grid h-full 出血至窗口底边；内容呼吸间距由内容区自身 padding 承担 */}
      <SplitSection portrait={portrait} portraitLeft={portraitLeft}>
        <div className="w-full py-6 lg:py-10">{content}</div>
      </SplitSection>
    </section>
  );
}