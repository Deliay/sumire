"use client";

import type { LiveEvent } from "../types";
import Sender from "./Sender";

interface DanmakuItemProps {
  event: LiveEvent;
}

/** 弹幕条目：Sender + 文本。 */
export default function DanmakuItem({ event }: DanmakuItemProps) {
  return (
    <div data-event-id={event.eventId} className="flex flex-col gap-1 px-3 py-2">
      <Sender sender={event.sender} />
      {event.content !== undefined && (
        <p className="text-sm break-words text-ink">{event.content}</p>
      )}
    </div>
  );
}
