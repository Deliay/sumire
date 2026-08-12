import { BookOpen, Images, Radio } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import PaperCard from "@/components/PaperCard";
import VineDivider from "@/components/VineDivider";
import ColorChip from "@/features/home/ColorChip";
import EntryCard from "@/features/home/EntryCard";
import { getAssetById, getProfile, getSite } from "@/lib/content";
import { assetThumbnailUrl } from "@/lib/content/shared";

const FACTS = (profile: ReturnType<typeof getProfile>) => [
  { label: "生日", value: profile.birthdayText },
  { label: "种族", value: profile.race },
  { label: "所属", value: `${profile.agency} · ${profile.generation}` },
  { label: "粉丝勋章", value: profile.fanBadge },
];

export default function Home() {
  const profile = getProfile();
  const site = getSite();
  const heroAsset = getAssetById("standing-01");
  if (!heroAsset) throw new Error("missing asset: standing-01");

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          className="fog fog-a -left-40 top-1/4 size-[42rem] bg-flower/10"
          aria-hidden
        />
        <div
          className="fog fog-b -right-32 bottom-0 size-[36rem] bg-primary/10"
          aria-hidden
        />

        <div className="relative mx-auto grid min-h-svh w-full max-w-6xl items-center gap-6 px-5 pt-16 lg:grid-cols-[1.1fr_1fr] lg:px-10">
          <div className="relative z-10 flex flex-col items-start gap-6 py-14">
            <p
              className="animate-rise font-display text-sm italic tracking-[0.35em] text-ink-dim"
              style={{ animationDelay: "0ms" }}
            >
              VirtuaReal · 二十八期
            </p>
            <h1
              className="animate-rise flex flex-col gap-1"
              style={{ animationDelay: "120ms" }}
            >
              <span className="font-serif text-6xl font-bold tracking-wider sm:text-7xl">
                枝堇
              </span>
              <span className="font-display text-4xl italic text-primary sm:text-5xl">
                Sumire
              </span>
            </h1>
            <p
              className="animate-rise max-w-md leading-loose text-ink-dim"
              style={{ animationDelay: "240ms" }}
            >
              {profile.bio}
            </p>
            <div
              className="animate-rise"
              style={{ animationDelay: "360ms" }}
            >
              <ColorChip color={profile.color} />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-16 opacity-25 sm:opacity-40 lg:relative lg:inset-auto lg:opacity-100">
            <Image
              src={assetThumbnailUrl(heroAsset)}
              alt={heroAsset.title}
              width={1000}
              height={2000}
              priority
              className="mx-auto h-full max-h-[88svh] w-auto object-contain [mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
            />
          </div>
        </div>

        <VineDivider grow className="relative z-10 -mt-2" />
      </section>

      {/* ---------- 入口 ---------- */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 lg:px-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <EntryCard
            href="/about"
            title="主播档案"
            description="设定、喜好、历程与梗——翻开店主留下的那册档案。"
            icon={BookOpen}
          />
          <EntryCard
            href="/assets"
            title="周边素材"
            description="立绘、插画与宣传图，高清原图可取，注意版权边界。"
            icon={Images}
          />
          <EntryCard
            href={site.links.live}
            title="直播间"
            description="老书屋营业中，藤蔓随时可能缠上你的脚踝。"
            icon={Radio}
            external
            badge="小藤尾巴出没中"
          />
        </div>
      </section>

      {/* ---------- 速览 ---------- */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 lg:px-10">
        <PaperCard>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {FACTS(profile).map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <dt className="text-xs tracking-widest text-ink-on-paper/60">
                  {fact.label}
                </dt>
                <dd className="font-serif font-semibold">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/about"
            className="mt-6 inline-block text-sm text-ink-on-paper/70 underline decoration-flower decoration-2 underline-offset-4 transition-colors hover:text-ink-on-paper"
          >
            了解更多 →
          </Link>
        </PaperCard>
      </section>
    </>
  );
}
