"use client";

import type { LiveEvent } from "../types";
import { formatPrice } from "../format";
import Sender from "./Sender";

interface GiftItemProps {
  event: LiveEvent;
}

/** 礼物条目：Sender + 礼物名称 × 数量 + 价值（元）。 */
export default function GiftItem({ event }: GiftItemProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-col gap-1">
        <Sender sender={event.sender} />
        {event.gift && (
          <p className="text-sm text-ink">
            赠送 {event.gift.name} <span className="text-ink-dim">× {event.gift.count}</span>
          </p>
        )}
      </div>
      {event.price !== undefined && event.price > 0 && (
        <span className="shrink-0 text-sm text-ink-dim">{formatPrice(event.price)}</span>
      )}
    </div>
  );
}
