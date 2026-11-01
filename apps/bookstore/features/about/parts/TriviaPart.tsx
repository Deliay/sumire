import { ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import Rule from "@/components/ui/Rule";
import Surface from "@/components/ui/Surface";
import type { Profile } from "@/lib/content";

/** P5 轶闻・Trivia：两列 Surface 卡片 + 官方外链按钮组。 */
export default function TriviaPart({ profile }: { profile: Profile }) {
  return (
    <>
      <section className="max-w-[36rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          {profile.anecdotes.map((anecdote) => (
            <Surface key={anecdote.title} padding="sm" className="flex flex-col gap-1.5">
              <h3 className="flex items-center gap-2 font-serif text-h3 font-semibold text-ink">
                <span aria-hidden>{anecdote.emoji}</span>
                {anecdote.title}
              </h3>
              <p className="text-small leading-relaxed text-ink-dim">{anecdote.body}</p>
            </Surface>
          ))}
        </div>
      </section>
      <section className="mt-10 flex max-w-[36rem] flex-col gap-4">
        <Rule label="传送门" />
        <div className="flex flex-wrap gap-3">
          {profile.links.map((link) => (
            <Button
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
              icon={<ExternalLink size={14} />}
              iconPosition="end"
            >
              {link.label}
            </Button>
          ))}
        </div>
      </section>
    </>
  );
}
