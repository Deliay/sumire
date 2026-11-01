import Plate from "@/components/ui/Plate";
import type { Asset, Profile } from "@/lib/content";
import { assetThumbnailUrl } from "@/lib/content/shared";

/** P1 信息・Profile：定义表；full 变体附立绘图版，bare 变体只保留表（首页右侧信息区用）。 */
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
    <dl
      className={`grid grid-cols-1 gap-x-8 gap-y-3 text-small ${
        variant === "bare" ? "sm:grid-cols-2" : ""
      }`}
    >
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
            className="inline-block size-3.5 rounded-sm border border-line-strong"
            style={{ backgroundColor: profile.color }}
            aria-hidden
          />
          <span className="font-mono text-label">{profile.color}</span>
        </dd>
      </div>
    </dl>
  );
  if (variant === "bare") {
    return <section>{grid}</section>;
  }
  return (
    <section>
      <div className="grid items-center gap-8 sm:grid-cols-[160px_1fr]">
        <Plate
          src={assetThumbnailUrl(portrait)}
          alt={portrait.title}
          width={500}
          height={1000}
          className="mx-auto w-full max-w-40 sm:max-w-none"
          frameClassName="aspect-[1/2]"
        />
        {grid}
      </div>
    </section>
  );
}
