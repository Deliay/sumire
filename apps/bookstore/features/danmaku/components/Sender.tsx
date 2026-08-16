"use client";

import type { LiveEvent } from "../types";

interface SenderProps {
  sender: LiveEvent["sender"];
}

/**
 * 公共发送者组件：头像 + 昵称 + 粉丝团牌子（按牌子颜色渲染）。
 * 点击新开 `https://space.bilibili.com/{uid}`；缺头像兜底昵称首字，无牌子不渲染。
 */
export default function Sender({ sender }: SenderProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <a
        href={`https://space.bilibili.com/${sender.uid}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="flex min-w-0 items-center gap-2 transition-colors duration-150 hover:text-primary"
      >
        {sender.face ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sender.face}
            alt=""
            className="size-7 shrink-0 rounded-full border border-vine/50 object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-vine/50 bg-soft text-xs text-ink-dim"
          >
            {sender.name.slice(0, 1)}
          </span>
        )}
        <span className="truncate text-sm font-medium text-ink">{sender.name}</span>
      </a>
      {sender.medal && (
        <span
          className="shrink-0 rounded border px-1 py-px text-xs leading-4"
          style={{ color: sender.medal.color, borderColor: sender.medal.color }}
        >
          {sender.medal.name} {sender.medal.level}
        </span>
      )}
    </span>
  );
}
