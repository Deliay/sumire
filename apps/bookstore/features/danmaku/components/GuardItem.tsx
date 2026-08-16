"use client";

import type { LiveEvent } from "../types";
import { formatPrice, guardLevelName, guardLevelTone } from "../format";
import Sender from "./Sender";

interface GuardItemProps {
  event: LiveEvent;
  /** 实时流到达的「New」标记。 */
  isNew?: boolean;
  /** 双击切换已读（admin 及以上传入；member 不渲染已读交互，与后端 403 口径一致）。 */
  onToggleRead?: (event: LiveEvent) => void;
}

/**
 * 上船条目：左侧船型色竖条 + 船型 chip（3/2/1 → 舰长蓝/提督紫/总督红，未知回退上游名称）
 * + Sender + 金额与数量（月数）。已读置灰；可交互时双击切换已读。实时流到达的上船带「New」标记。
 */
export default function GuardItem({ event, isNew = false, onToggleRead }: GuardItemProps) {
  const guard = event.guard;
  const shipName = guard ? (guardLevelName(guard.level) ?? guard.name) : "";
  const tone = guard ? guardLevelTone(guard.level) : guardLevelTone(2);
  return (
    <div
      data-event-id={event.eventId}
      onDoubleClick={onToggleRead ? () => onToggleRead(event) : undefined}
      title={onToggleRead ? "双击切换已读" : undefined}
      className={`flex gap-2.5 px-3 py-2 transition-opacity duration-150 ${
        event.read ? "opacity-60" : ""
      } ${onToggleRead ? "cursor-pointer select-none" : ""}`}
    >
      <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${tone.bar}`} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            {shipName && (
              <span className={`shrink-0 rounded-sm px-1.5 py-px text-[10px] leading-4 font-medium text-ink ${tone.chip}`}>
                上船 · {shipName}
              </span>
            )}
            {guard && (
              <p className="truncate text-sm text-ink">
                <span className="text-ink-dim">开通</span> {guard.count} 个月
              </p>
            )}
            {isNew && (
              <span className="shrink-0 rounded-sm bg-flower px-1.5 py-px text-[10px] leading-4 font-bold text-white">
                New
              </span>
            )}
          </div>
          <Sender sender={event.sender} />
        </div>
        {event.price !== undefined && (
          <span className={`shrink-0 text-sm font-semibold ${tone.text}`}>{formatPrice(event.price)}</span>
        )}
      </div>
    </div>
  );
}
