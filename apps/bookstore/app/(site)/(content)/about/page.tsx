import VineDivider from "@/components/VineDivider";
import {
  JourneyPart,
  ProfilePart,
  StoryPart,
  TastePart,
  TriviaPart,
} from "@/features/about/parts";
import { getAssetById, getProfile } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "主播档案" };

export default function AboutPage() {
  const profile = getProfile();
  const portraitAsset = getAssetById("standing-02");
  if (!portraitAsset) throw new Error("missing asset: standing-02");

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

      {/* ---------- 信息卡 ---------- */}
      <section className="mt-10">
        <ProfilePart profile={profile} portrait={portraitAsset} />
      </section>

      <VineDivider className="mt-14 opacity-70" />

      <section className="mt-14">
        <StoryPart profile={profile} />
      </section>

      <section className="mt-14">
        <TastePart profile={profile} />
      </section>

      <section className="mt-14">
        <JourneyPart profile={profile} />
      </section>

      <div className="mt-14">
        <TriviaPart profile={profile} />
      </div>
    </div>
  );
}