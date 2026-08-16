"use client";

import type { LiveEvent } from "../types";
import Sender from "./Sender";

interface DanmakuItemProps {
  event: LiveEvent;
}

/** 弹幕条目：Sender + 文本；表情弹幕渲染表情图片。 */
export default function DanmakuItem({ event }: DanmakuItemProps) {
  return (
    <div data-event-id={event.eventId} className="flex flex-col gap-1 px-3 py-2">
      <Sender sender={event.sender} />
      {event.emote?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.emote.url}
          alt={event.emote.name ?? "弹幕表情"}
          title={event.emote.name}
          className="h-16 w-auto rounded border border-vine/30"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        event.content !== undefined && (
          <p className="text-sm break-words text-ink">{event.content}</p>
        )
      )}
    </div>
  );
}
