import VineDivider from "@/components/VineDivider";
import {
  JourneyPart,
  ProfilePart,
  SplitSection,
  StoryPart,
  TastePart,
  TriviaPart,
} from "@/features/about/parts";
import { getAssetById, getProfile } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "主播档案" };

const ARCHIVE_PORTRAITS = ["standing-01", "standing-02"];

export default function AboutPage() {
  const profile = getProfile();
  const portraitAsset = getAssetById("standing-02");
  if (!portraitAsset) throw new Error("missing asset: standing-02");
  const portraits = ARCHIVE_PORTRAITS.map((id) => getAssetById(id)).filter(
    (a): a is NonNullable<typeof a> => a !== null,
  );

  // 各分栏立绘（与主页档案屏一致：仅立绘、非相邻同图循环选取，单数屏立绘在左双数屏在右）
  const STANDING_CYCLE = [0, 1, 0, 1, 0] as const;
  const portraitFor = (index: number) =>
    portraits.length > 0
      ? portraits[STANDING_CYCLE[index % STANDING_CYCLE.length] % portraits.length]
      : portraits[0];
  const left = (index: number) => index % 2 === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-28 lg:px-10">
      {/* ---------- 页头 ---------- */}
      <header className="relative flex flex-col gap-2">
        <span className="font-display text-sm italic tracking-[0.35em] text-ink-dim">
          Profile
        </span>
        <h1 className="font-serif text-4xl font-bold tracking-wider">
          枝堇图鉴
        </h1>
        <p className="mt-2 font-display text-lg italic text-ink-dim">
          “{profile.quote}”
        </p>
      </header>

      {/* ---------- 信息 ---------- */}
      <section className="mt-10">
        <SplitSection portrait={portraitFor(0)} portraitLeft={left(0)}>
          <ProfilePart profile={profile} portrait={portraitAsset} />
        </SplitSection>
      </section>

      <VineDivider className="mt-14 opacity-70" />

      {/* ---------- 设定 ---------- */}
      <section className="mt-14">
        <SplitSection portrait={portraitFor(1)} portraitLeft={left(1)}>
          <StoryPart profile={profile} />
        </SplitSection>
      </section>

      {/* ---------- 喜好 ---------- */}
      <section className="mt-14">
        <SplitSection portrait={portraitFor(2)} portraitLeft={left(2)}>
          <TastePart profile={profile} />
        </SplitSection>
      </section>

      {/* ---------- 历程 ---------- */}
      <section className="mt-14">
        <SplitSection portrait={portraitFor(3)} portraitLeft={left(3)}>
          <JourneyPart profile={profile} />
        </SplitSection>
      </section>

      {/* ---------- 轶闻 ---------- */}
      <div className="mt-14">
        <SplitSection portrait={portraitFor(4)} portraitLeft={left(4)}>
          <TriviaPart profile={profile} />
        </SplitSection>
      </div>
    </div>
  );
}