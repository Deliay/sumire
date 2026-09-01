import type { Profile } from "@/lib/content";
import { SectionTitle } from "./SectionTitle";

/** P2 设定・Story：出道故事与预告专栏引文（氛围层底色直排，非白卡）。 */
export default function StoryPart({ profile }: { profile: Profile }) {
  const storyParagraphs = profile.debutStory
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const introParagraphs = profile.debutIntro
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <section className="flex flex-col gap-6">
      <SectionTitle sub="Story">设定</SectionTitle>
      <div className="flex flex-col gap-5 font-serif leading-loose">
        {storyParagraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 12)} className="indent-8">
            {paragraph}
          </p>
        ))}
        <blockquote className="border-l-2 border-flower pl-5 text-ink/80">
          {introParagraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 12)} className="mb-3 indent-8">
              {paragraph}
            </p>
          ))}
          <cite className="block text-right text-sm not-italic text-ink-dim">
            —— VirtuaReal 预告专栏（节选）
          </cite>
        </blockquote>
      </div>
    </section>
  );
}
