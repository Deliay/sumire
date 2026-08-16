"use client";

import type { LiveEvent } from "../types";
import { formatPrice, guardLevelName } from "../format";
import Sender from "./Sender";

interface GuardItemProps {
  event: LiveEvent;
  /** 双击切换已读（admin 及以上传入；member 不渲染已读交互，与后端 403 口径一致）。 */
  onToggleRead?: (event: LiveEvent) => void;
}

/**
 * 上船条目：船型（guard_level 3/2/1 → 舰长/提督/总督，未知回退上游名称）+ 金额 + 数量（月数）。
 * 已读置灰；可交互时双击切换已读。
 */
export default function GuardItem({ event, onToggleRead }: GuardItemProps) {
  const guard = event.guard;
  const shipName = guard ? (guardLevelName(guard.level) ?? guard.name) : "";
  return (
    <div
      data-event-id={event.eventId}
      onDoubleClick={onToggleRead ? () => onToggleRead(event) : undefined}
      title={onToggleRead ? "双击切换已读" : undefined}
      className={`flex items-center justify-between gap-2 px-3 py-2 transition-opacity duration-150 ${
        event.read ? "opacity-60" : ""
      } ${onToggleRead ? "cursor-pointer select-none" : ""}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Sender sender={event.sender} />
        {guard && (
          <p className="text-sm text-ink">
            开通 {shipName} <span className="text-ink-dim">× {guard.count} 个月</span>
          </p>
        )}
      </div>
      {event.price !== undefined && (
        <span className="shrink-0 text-sm font-semibold text-flower">{formatPrice(event.price)}</span>
      )}
    </div>
  );
}
