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
  const left = part % 2 === 1;
  const content = (
    <div className="flex min-h-0 flex-col justify-center gap-4">
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      {part === 1 && <ProfilePart profile={profile} portrait={portrait} />}
      {part === 2 && <StoryPart profile={profile} />}
      {part === 3 && <TastePart profile={profile} />}
      {part === 4 && <JourneyPart profile={profile} />}
      {part === 5 && <TriviaPart profile={profile} />}
    </div>
  );
  const artwork = portrait ? (
    <div className="pointer-events-none relative flex h-full items-center justify-center">
      <Image
        src={assetOriginalWebpUrl(portrait)}
        alt={portrait.title}
        width={1000}
        height={2000}
        className="h-full w-auto object-contain"
      />
    </div>
  ) : null;

  return (
    <section className="relative flex h-svh flex-col overflow-hidden px-5 py-6 lg:px-10">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {left ? (
          <>
            <div className="hidden lg:block">{artwork}</div>
            <div className="flex min-h-0 items-center overflow-y-auto lg:justify-center">{content}</div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 items-center overflow-y-auto lg:justify-center">{content}</div>
            <div className="hidden lg:block">{artwork}</div>
          </>
        )}
      </div>
    </section>
  );
}