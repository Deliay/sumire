"use client";

import type { LiveEvent } from "../types";
import { formatPrice } from "../format";
import Sender from "./Sender";

interface GiftItemProps {
  event: LiveEvent;
}

/** 礼物条目：左侧 primary 竖条 + 「礼物」chip + Sender；礼物名 × 数量 + 价值（元）强调。 */
export default function GiftItem({ event }: GiftItemProps) {
  return (
    <div data-event-id={event.eventId} className="flex gap-2.5 px-3 py-2">
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-primary/70" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 rounded-sm bg-primary/25 px-1.5 py-px text-[10px] leading-4 font-medium text-ink">
              礼物
            </span>
            {event.gift && (
              <p className="truncate text-sm font-medium text-ink">
                {event.gift.name}
                <span className="text-ink-dim"> × {event.gift.count}</span>
              </p>
            )}
          </div>
          <Sender sender={event.sender} />
        </div>
        {event.price !== undefined && event.price > 0 && (
          <span className="shrink-0 text-sm font-semibold text-ink-on-paper">{formatPrice(event.price)}</span>
        )}
      </div>
    </div>
  );
}
