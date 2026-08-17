"use client";

import type { LiveEvent } from "../types";
import { formatPrice } from "../format";
import { hasBiliLink } from "../biliVideo";
import BiliVideoLink from "./BiliVideoLink";
import Sender from "./Sender";

interface SuperChatItemProps {
  event: LiveEvent;
  /** 实时流到达的「New」标记。 */
  isNew?: boolean;
  /** 双击切换已读（admin 及以上传入；member 不渲染已读交互，与后端 403 口径一致）。 */
  onToggleRead?: (event: LiveEvent) => void;
}

/**
 * SC 条目（提案 K6）：两行——Sender + 金额；留言气泡按 scColors 渐变底色与文字色渲染。
 * 已读置灰；可交互时双击切换已读。实时流到达的 SC 带「New」标记。
 */
export default function SuperChatItem({ event, isNew = false, onToggleRead }: SuperChatItemProps) {
  const colors = event.scColors;
  return (
    <div
      data-event-id={event.eventId}
      onDoubleClick={onToggleRead ? () => onToggleRead(event) : undefined}
      title={onToggleRead ? "双击切换已读" : undefined}
      className={`flex gap-2.5 px-3 py-2 transition-opacity duration-150 ${
        event.read ? "opacity-60" : ""
      } ${onToggleRead ? "cursor-pointer select-none" : ""}`}
    >
      <span aria-hidden className="w-1 shrink-0 self-stretch rounded-full bg-flower/70" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sender sender={event.sender} />
            {isNew && (
              <span className="shrink-0 rounded-sm bg-flower px-1.5 py-px text-[10px] leading-4 font-bold text-white">
                New
              </span>
            )}
          </div>
          {event.price !== undefined && (
            <span className="shrink-0 text-sm font-semibold text-flower">{formatPrice(event.price)}</span>
          )}
        </div>
        {event.content !== undefined && (
          <p
            className="rounded-md px-2 py-1.5 text-sm break-words"
            style={
              colors
                ? {
                    background: `linear-gradient(135deg, ${colors.backgroundStart}, ${colors.backgroundEnd})`,
                    color: colors.fontColor,
                  }
                : undefined
            }
          >
            {hasBiliLink(event.content) ? (
              <BiliVideoLink text={event.content} className={colors ? "text-[inherit]" : undefined} />
            ) : (
              event.content
            )}
            {event.contentRomaji && (
              <span className="block text-xs opacity-75">{event.contentRomaji}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
