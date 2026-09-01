"use client";

import Image from "next/image";
import { JourneyPart, ProfilePart, StoryPart, TastePart, TriviaPart } from "@/features/about/parts";
import { ARCHIVE_TITLES } from "@/features/home/sections";
import type { Asset, Profile } from "@/lib/content";
import { assetOriginalWebpUrl } from "@/lib/content/shared";

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
  const left = part % 2 === 1;

  const content = (
    <div className="flex min-h-0 flex-col justify-center gap-4 lg:gap-5">
      {part === 1 && (
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      )}
      {part === 1 && <ProfilePart profile={profile} portrait={profilePortrait} />}
      {part === 2 && <StoryPart profile={profile} />}
      {part === 3 && <TastePart profile={profile} />}
      {part === 4 && <JourneyPart profile={profile} />}
      {part === 5 && <TriviaPart profile={profile} />}
    </div>
  );

  const artwork = portrait ? (
    <div className="pointer-events-none relative flex h-full min-h-0 items-center justify-center">
      <Image
        src={assetOriginalWebpUrl(portrait)}
        alt={portrait.title}
        width={1000}
        height={2000}
        className="max-h-full w-auto object-contain"
      />
    </div>
  ) : null;

  return (
    <section className="relative flex h-svh flex-col overflow-hidden px-5 py-6 lg:px-10">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 移动端立绘在上、内容在下；桌面单数屏立绘左双数屏立绘右；桌面立绘列约束在屏高内完整显示 */}
        <div className={`order-1 h-[40svh] min-h-0 lg:h-full ${left ? "lg:order-1" : "lg:order-2"}`}>{artwork}</div>
        <div
          className={`order-2 flex min-h-0 items-center overflow-y-auto lg:justify-center lg:overflow-visible ${
            left ? "lg:order-2" : "lg:order-1"
          }`}
        >
          {content}
        </div>
      </div>
    </section>
  );
}