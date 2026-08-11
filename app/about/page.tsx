import Image from "next/image";
import ExternalButton from "@/components/ExternalButton";
import LaceFrame from "@/components/LaceFrame";
import PaperCard from "@/components/PaperCard";
import Tag from "@/components/Tag";
import VineDivider from "@/components/VineDivider";
import VineTimeline from "@/features/about/VineTimeline";
import { getProfile } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "主播档案" };

function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="font-serif text-2xl font-semibold text-ink">{children}</h2>
      <span className="font-display text-sm italic tracking-widest text-ink-dim">
        {sub}
      </span>
    </div>
  );
}

export default function AboutPage() {
  const profile = getProfile();

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

  const storyParagraphs = profile.debutStory
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const introParagraphs = profile.debutIntro
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const tagGroups: [string, string[]][] = [
    ["喜欢", profile.likes],
    ["不擅长", profile.dislikes],
    ["常玩", profile.games],
  ];

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
        <LaceFrame>
          <div className="grid items-center gap-8 sm:grid-cols-[220px_1fr]">
            <div className="mx-auto w-44 overflow-hidden rounded-lg border border-vine/50 bg-soft sm:w-full">
              <Image
                src="/assets/thumbnails/standing-02.webp"
                alt="枝堇立绘（披肩）"
                width={500}
                height={1000}
                className="h-auto w-full"
              />
            </div>
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
                  <span className="font-display tracking-widest">
                    {profile.color}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </LaceFrame>
      </section>

      <VineDivider className="mt-14 opacity-70" />

      {/* ---------- 设定故事 ---------- */}
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Story">设定</SectionTitle>
        <PaperCard>
          <div className="flex flex-col gap-5 font-serif leading-loose">
            {storyParagraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 12)} className="indent-8">
                {paragraph}
              </p>
            ))}
            <blockquote className="border-l-2 border-flower pl-5 text-ink-on-paper/80">
              {introParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 12)} className="mb-3 indent-8">
                  {paragraph}
                </p>
              ))}
              <cite className="block text-right text-sm not-italic text-ink-on-paper/50">
                —— VirtuaReal 预告专栏（节选）
              </cite>
            </blockquote>
          </div>
        </PaperCard>
      </section>

      {/* ---------- 喜好 ---------- */}
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Taste">喜好</SectionTitle>
        <div className="flex flex-col gap-5">
          {tagGroups.map(([label, tags]) => (
            <div key={label} className="flex flex-wrap items-center gap-3">
              <span className="w-16 shrink-0 font-serif text-ink-dim">
                {label}
              </span>
              {tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 历程 ---------- */}
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Journey">历程</SectionTitle>
        <VineTimeline milestones={profile.milestones} />
      </section>

      {/* ---------- 逸闻 ---------- */}
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Trivia">逸闻</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          {profile.anecdotes.map((anecdote) => (
            <article
              key={anecdote.title}
              className="rounded-lg border border-vine/50 bg-raised p-5"
            >
              <h3 className="flex items-center gap-2 font-serif font-semibold text-ink">
                <span aria-hidden>{anecdote.emoji}</span>
                {anecdote.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-dim">
                {anecdote.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- 链接 ---------- */}
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Links">传送门</SectionTitle>
        <div className="flex flex-wrap gap-4">
          {profile.links.map((link) => (
            <ExternalButton key={link.url} href={link.url} label={link.label} />
          ))}
        </div>
      </section>
    </div>
  );
}
