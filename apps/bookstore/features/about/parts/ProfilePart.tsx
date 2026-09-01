import Image from "next/image";
import LaceFrame from "@/components/LaceFrame";
import type { Asset, Profile } from "@/lib/content";
import { assetThumbnailUrl } from "@/lib/content/shared";

/** P1 信息・Profile：立绘 + 基本信息卡。variant="bare" 省略立绘与蕾丝框（首页档案屏右侧信息区用，避免与大屏立绘重复）。 */
export default function ProfilePart({
  profile,
  portrait,
  variant = "full",
}: {
  profile: Profile;
  portrait: Asset;
  variant?: "full" | "bare";
}) {
  const facts: [string, string][] = [
    ["本名", profile.displayName],
    ["生日", `${profile.birthdayText}（${profile.zodiac}）`],
    ["种族", profile.race],
    ["身高", profile.height],
    ["身份", profile.identity],
    ["所属", `${profile.agency} · ${profile.generation}`],
    ["粉丝勋章", profile.fanBadge],
    ["代表 Emoji", profile.emoji],
    ["Live2D", profile.modelArtist],
  ];
  const grid = (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="flex gap-3">
          <dt className="w-20 shrink-0 text-ink-dim">{label}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <dt className="w-20 shrink-0 text-ink-dim">应援色</dt>
        <dd className="inline-flex items-center gap-2 text-ink">
          <span
            className="inline-block size-3.5 rounded-full"
            style={{ backgroundColor: profile.color }}
            aria-hidden
          />
          <span className="font-display tracking-widest">{profile.color}</span>
        </dd>
      </div>
    </dl>
  );
  if (variant === "bare") {
    return <section>{grid}</section>;
  }
  return (
    <section>
      <LaceFrame>
        <div className="grid items-center gap-8 sm:grid-cols-[220px_1fr]">
          <div className="mx-auto w-44 overflow-hidden rounded-lg border border-vine/50 bg-soft sm:w-full">
            <Image
              src={assetThumbnailUrl(portrait)}
              alt={portrait.title}
              width={500}
              height={1000}
              className="h-auto w-full"
            />
          </div>
          {grid}
        </div>
      </LaceFrame>
    </section>
  );
}