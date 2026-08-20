"use client";

import type { LiveEvent } from "../../types";
import { splitByKeyword, formatOccurredAt } from "../highlight";
import { guardDanmakuTint } from "../../format";

interface SearchResultCardProps {
  event: LiveEvent;
  keyword: string;
}

export default function SearchResultCard({ event, keyword }: SearchResultCardProps) {
  const tint = guardDanmakuTint(event.sender.guardLevel);
  const content = event.content ?? "";
  const segments = splitByKeyword(content, keyword);

  return (
    <div className={`flex w-full gap-2.5 px-3 py-2 sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]${tint ? ` ${tint}` : ""} rounded-md`}>
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-vine/70" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{event.sender.name}</span>
          {event.sender.medal && (
            <span
              className="shrink-0 rounded px-1 py-px text-[10px] leading-4"
              style={{ backgroundColor: event.sender.medal.color + "20", color: event.sender.medal.color }}
            >
              {event.sender.medal.name}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-ink-dim">{formatOccurredAt(event.occurredAt)}</span>
        </div>
        {event.emote?.url ? (
          <img
            src={event.emote.url}
            alt={event.emote.name ?? "弹幕表情"}
            title={event.emote.name}
            width={event.emote.width}
            height={event.emote.height}
            className="h-auto w-auto max-w-full rounded object-contain max-h-16"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <p className="text-sm leading-snug break-words text-ink">
            {segments.map((seg, i) =>
              seg.hit ? (
                <mark key={i} className="rounded-sm bg-eye/30 px-0.5">{seg.text}</mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
        )}
      </div>
    </div>
  );
}
