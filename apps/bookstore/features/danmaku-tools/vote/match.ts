import type { VoteOption } from "./types";

export function matchVote(
  content: string,
  options: VoteOption[],
): string | null {
  const matched = options.filter((o) => content.includes(o.keyword));
  return matched.length === 1 ? matched[0].id : null;
}

export function hasKeywordConflict(
  keyword: string,
  existing: VoteOption[],
): boolean {
  return existing.some(
    (o) => o.keyword.includes(keyword) || keyword.includes(o.keyword),
  );
}
