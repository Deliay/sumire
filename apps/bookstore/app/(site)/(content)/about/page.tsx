import type { Metadata } from "next";
import PageHeader from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";
import SectionHeader from "@/components/layout/SectionHeader";
import {
  JourneyPart,
  ProfilePart,
  SplitSection,
  StoryPart,
  TastePart,
  TriviaPart,
} from "@/features/about/parts";
import { getAssetById, getProfile } from "@/lib/content";

export const metadata: Metadata = { title: "主播档案" };

const ARCHIVE_PORTRAITS = ["standing-01", "standing-02"];

export default function AboutPage() {
  const profile = getProfile();
  const portraitAsset = getAssetById("standing-02");
  if (!portraitAsset) throw new Error("missing asset: standing-02");
  const portraits = ARCHIVE_PORTRAITS.map((id) => getAssetById(id)).filter(
    (a): a is NonNullable<typeof a> => a !== null,
  );

  // /about 首节「信息」用 ProfilePart full（内立绘恒为 standing-02），首节大屏须避开同图并排 → standing-01。
  const STANDING_CYCLE = [0, 1, 0, 1, 0] as const;
  const portraitFor = (index: number) =>
    portraits.length > 0
      ? portraits[STANDING_CYCLE[index % STANDING_CYCLE.length] % portraits.length]
      : portraits[0];
  const portrait = (index: number) => {
    const asset = portraitFor(index);
    if (!asset) throw new Error("missing archive portrait");
    return asset;
  };

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Profile"
        folio="壹"
        title="枝堇图鉴"
        lead={`“${profile.quote}”`}
      />

      <section className="mt-14 flex flex-col gap-6">
        <SectionHeader folio="壹" eyebrow="Profile" title="信息" />
        <SplitSection portrait={portrait(0)}>
          <ProfilePart profile={profile} portrait={portraitAsset} />
        </SplitSection>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader folio="贰" eyebrow="Story" title="设定" />
        <SplitSection portrait={portrait(1)}>
          <StoryPart profile={profile} />
        </SplitSection>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader folio="叁" eyebrow="Taste" title="喜好" />
        <SplitSection portrait={portrait(2)}>
          <TastePart profile={profile} />
        </SplitSection>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader folio="肆" eyebrow="Journey" title="历程" />
        <SplitSection portrait={portrait(3)}>
          <JourneyPart profile={profile} />
        </SplitSection>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader folio="伍" eyebrow="Trivia" title="轶闻" />
        <SplitSection portrait={portrait(4)}>
          <TriviaPart profile={profile} />
        </SplitSection>
      </section>
    </PageShell>
  );
}
