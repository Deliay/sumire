"use client";

import type { LiveEvent } from "../types";
import Sender from "./Sender";

interface DanmakuItemProps {
  event: LiveEvent;
}

/**
 * 是否为「小表情」：源图为 emoji 风格小图（如 [比心]/[花]，原图约 20px）。
 * 以源图最大边 ≤ 32px 判定，缩小渲染上限（max-h-8=32px）；其余表情（如房间大表情 162px）保留 64px 上限。
 */
function isSmallEmote(emote: NonNullable<LiveEvent["emote"]>): boolean {
  const max = Math.max(emote.width ?? 0, emote.height ?? 0);
  return max > 0 && max <= 32;
}

/** 弹幕条目：左侧 vine 竖条 + Sender；表情弹幕渲染表情图片。 */
export default function DanmakuItem({ event }: DanmakuItemProps) {
  return (
    <div data-event-id={event.eventId} className="flex gap-2.5 px-3 py-2">
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-vine/70" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Sender sender={event.sender} compact />
        {event.emote?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.emote.url}
            alt={event.emote.name ?? "弹幕表情"}
            title={event.emote.name}
            width={event.emote.width}
            height={event.emote.height}
            className={`h-auto w-auto max-w-full rounded border border-vine/30 object-contain ${
              isSmallEmote(event.emote) ? "max-h-8" : "max-h-16"
            }`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          event.content !== undefined && (
            <p className="text-base leading-snug font-semibold break-words text-ink">{event.content}</p>
          )
        )}
      </div>
    </div>
  );
}
