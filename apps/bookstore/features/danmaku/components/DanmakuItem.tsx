"use client";

import type { LiveEvent } from "../types";
import Sender from "./Sender";

interface DanmakuItemProps {
  event: LiveEvent;
}

/** 弹幕条目：左侧 vine 竖条 + 「弹幕」chip + Sender；表情弹幕渲染表情图片。 */
export default function DanmakuItem({ event }: DanmakuItemProps) {
  return (
    <div data-event-id={event.eventId} className="flex gap-2.5 px-3 py-2">
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-vine/70" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="shrink-0 rounded-sm bg-vine/20 px-1.5 py-px text-[10px] leading-4 text-paper-dim">
            弹幕
          </span>
          <Sender sender={event.sender} />
        </div>
        {event.emote?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.emote.url}
            alt={event.emote.name ?? "弹幕表情"}
            title={event.emote.name}
            width={event.emote.width}
            height={event.emote.height}
            className="h-auto w-auto max-h-16 max-w-full rounded border border-vine/30 object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          event.content !== undefined && (
            <p className="text-[15px] leading-snug font-semibold break-words text-ink">{event.content}</p>
          )
        )}
      </div>
    </div>
  );
}
