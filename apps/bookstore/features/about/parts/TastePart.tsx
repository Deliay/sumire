import Tag from "@/components/Tag";
import type { Profile } from "@/lib/content";
import { SectionTitle } from "./SectionTitle";

/** P3 喜好・Taste：标签组。 */
export default function TastePart({ profile }: { profile: Profile }) {
  const tagGroups: [string, string[]][] = [
    ["喜欢", profile.likes],
    ["不擅长", profile.dislikes],
    ["常玩", profile.games],
    ["常读/常看", profile.bookAnimeTypes],
    ["常听", profile.musicTypes],
  ];
  return (
    <section className="flex flex-col gap-6">
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
        {profile.gameGenre && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-16 shrink-0 font-serif text-ink-dim">偏好类型</span>
            <Tag>{profile.gameGenre}</Tag>
          </div>
        )}
      </div>
    </section>
  );
}