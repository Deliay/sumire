"use client";

import SectionHeader from "@/components/layout/SectionHeader";
import { JourneyPart, ProfilePart, SplitSection, StoryPart, TastePart, TriviaPart } from "@/features/about/parts";
import { ARCHIVE_TITLES } from "@/features/home/sections";
import { FOLIOS } from "@/features/home/pageIndex";
import type { Asset, Profile } from "@/lib/content";

/**
 * 档案各屏立绘选取（持书/非持书错位）：P1/P3/P5→standing-02、P2/P4→standing-01。
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
  const def = ARCHIVE_TITLES[part - 1];
  const fullTitle = def?.title ?? "";
  const [title, english = ""] = fullTitle.split(" · ");
  const standings = portraitAssets.filter((a) => a.category === "standing");
  const portrait =
    standings.length > 0
      ? standings[STANDING_CYCLE[(part - 1) % STANDING_CYCLE.length] % standings.length]
      : portraitAssets[(part - 1) % portraitAssets.length];
  const profilePortrait = portraitAssets.find((a) => a.id === "standing-02") ?? portrait;

  const content = (
    <div className="flex min-h-0 flex-col gap-5">
      {part === 1 && <ProfilePart profile={profile} portrait={profilePortrait} variant="bare" />}
      {part === 2 && <StoryPart profile={profile} />}
      {part === 3 && <TastePart profile={profile} />}
      {part === 4 && <JourneyPart profile={profile} />}
      {part === 5 && <TriviaPart profile={profile} />}
    </div>
  );

  return (
    <section className="relative flex h-svh flex-col overflow-hidden">
      <div className="flex h-full min-h-0 flex-col px-5 pb-8 pt-24 lg:px-16 lg:pb-12 lg:pt-24">
        <SectionHeader
          folio={FOLIOS[part]}
          eyebrow={english}
          title={title}
          className="mb-6 shrink-0"
        />
        <div className="min-h-0 flex-1">
          <SplitSection portrait={portrait} anchorContentBottom>
            {content}
          </SplitSection>
        </div>
      </div>
    </section>
  );
}
