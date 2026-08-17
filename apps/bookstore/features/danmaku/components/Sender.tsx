"use client";

import type { LiveEvent } from "../types";
import { guardBadgeAsset, guardLevelName, guardLevelTone } from "../format";

interface SenderProps {
  sender: LiveEvent["sender"];
  /** 紧凑弱化形态（弹幕条目用）：更小头像、更暗昵称与牌子，避免与内容争夺注意。 */
  compact?: boolean;
  /**
   * 头像挂件等级覆盖（guard_buy 条目用：事件携带的船型等级，如 buyer 的 sender.guardLevel 缺省时，
   * 仍按所购船型在头像上渲染挂件）；传 undefined 时回退 sender.guardLevel。
   */
  guardLevel?: number | null;
}

/**
 * 公共发送者组件：头像（含上船挂件）+ 昵称 + 粉丝团牌子（按牌子颜色渲染）。
 * 点击新开 `https://space.bilibili.com/{uid}`；缺头像兜底昵称首字，无牌子不渲染。
 * 头像右下角渲染船型挂件（3=舰长 / 2=提督 / 1=总督，本地素材），无上船等级不渲染。
 */
export default function Sender({ sender, compact = false, guardLevel }: SenderProps) {
  const badgeLevel = guardLevel !== undefined ? guardLevel : sender.guardLevel;
  const badge = badgeLevel != null ? guardBadgeAsset(badgeLevel) : null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <a
        href={`https://space.bilibili.com/${sender.uid}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`flex min-w-0 items-center gap-2 transition-colors duration-150 hover:text-primary ${
          compact ? "text-ink-dim" : ""
        }`}
      >
        <span className="relative shrink-0">
          {sender.face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sender.face}
              alt=""
              className={`shrink-0 rounded-full border object-cover ${
                compact ? "size-5 border-vine/40 opacity-80" : "size-7 border-vine/50"
              }`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden
              className={`flex shrink-0 items-center justify-center rounded-full border bg-soft text-ink-dim ${
                compact ? "size-5 border-vine/40 text-[10px]" : "size-7 border-vine/50 text-xs"
              }`}
            >
              {sender.name.slice(0, 1)}
            </span>
          )}
          {badge && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={badge}
              alt=""
              className={`absolute right-0 bottom-0 rounded-full object-cover ring-1 ring-raised ${
                compact ? "size-6" : "size-8"
              }`}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}

        </span>
        <span className="flex min-w-0 flex-col justify-center">
          <span
            className={`truncate ${
              compact ? "text-xs text-ink-dim" : "text-sm font-medium text-ink"
            }`}
          >
            {sender.name}
          </span>
          {sender.nameRomaji && (
            <span
              className={`truncate text-ink-dim ${
                compact ? "text-[10px]" : "text-xs"
              }`}
            >
              {sender.nameRomaji}
            </span>
          )}
        </span>
      </a>
      {sender.medal && (
        <span
          className={`shrink-0 rounded px-1 py-px leading-4 ${
            compact ? "text-[10px] opacity-70" : "text-xs"
          }`}
          style={{ color: "#ffffff", backgroundColor: sender.medal.color }}
        >
          {sender.medal.name} {sender.medal.level}
        </span>
      )}
      {sender.guardLevel != null && guardLevelName(sender.guardLevel) && (
        <span
          className={`shrink-0 rounded px-1 py-px font-medium leading-4 ${
            compact ? "text-[10px]" : "text-xs"
          } ${guardLevelTone(sender.guardLevel).chip} ${guardLevelTone(sender.guardLevel).text}`}
        >
          {guardLevelName(sender.guardLevel)}
        </span>
      )}
    </span>
  );
}
