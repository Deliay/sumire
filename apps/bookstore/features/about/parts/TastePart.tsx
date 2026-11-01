import Tag from "@/components/ui/Tag";
import type { Profile } from "@/lib/content";

/** P3 喜好・Taste：标签组（组名 6rem 左列）。 */
export default function TastePart({ profile }: { profile: Profile }) {
  const tagGroups: [string, string[]][] = [
    ["喜欢", profile.likes],
    ["不擅长", profile.dislikes],
    ["常玩", profile.games],
    ["常读/常看", profile.bookAnimeTypes],
    ["常听", profile.musicTypes],
  ];
  return (
    <section className="flex max-w-[36rem] flex-col gap-4">
      {tagGroups.map(([label, tags]) => (
        <div key={label} className="flex flex-wrap items-start gap-3">
          <span className="w-24 shrink-0 pt-1.5 text-small text-ink-dim">{label}</span>
          <span className="flex flex-1 flex-wrap gap-2">
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </span>
        </div>
      ))}
      {profile.gameGenre ? (
        <div className="flex flex-wrap items-start gap-3">
          <span className="w-24 shrink-0 pt-1.5 text-small text-ink-dim">偏好类型</span>
          <Tag>{profile.gameGenre}</Tag>
        </div>
      ) : null}
    </section>
  );
}
