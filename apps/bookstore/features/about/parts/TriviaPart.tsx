import ExternalButton from "@/components/ExternalButton";
import type { Profile } from "@/lib/content";
import { SectionTitle } from "./SectionTitle";

/** P5 轶闻・Trivia：逸闻卡 + 官方外链按钮组。 */
export default function TriviaPart({ profile }: { profile: Profile }) {
  return (
    <>
      <section className="flex flex-col gap-6">
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
      <section className="mt-14 flex flex-col gap-6">
        <SectionTitle sub="Links">传送门</SectionTitle>
        <div className="flex flex-wrap gap-4">
          {profile.links.map((link) => (
            <ExternalButton key={link.url} href={link.url} label={link.label} />
          ))}
        </div>
      </section>
    </>
  );
}