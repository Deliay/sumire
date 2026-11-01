import type { Profile } from "@/lib/content";

/** P2 设定・Story：宋体正文、首行缩进 2 字符；引文 2px primary 左边线。 */
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
    <section className="flex max-w-[36rem] flex-col gap-5 font-serif leading-loose">
      {storyParagraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 12)} className="indent-8">
          {paragraph}
        </p>
      ))}
      <blockquote className="border-l-2 border-primary pl-5 text-ink/80">
        {introParagraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 12)} className="mb-3 indent-8">
            {paragraph}
          </p>
        ))}
        <cite className="block text-right font-mono text-label not-italic text-ink-dim">
          —— VirtuaReal 预告专栏（节选）
        </cite>
      </blockquote>
    </section>
  );
}
