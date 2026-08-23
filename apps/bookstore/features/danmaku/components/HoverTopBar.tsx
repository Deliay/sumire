"use client";

import type { HoverPill } from "../hoverTopBar";
import type { LiveEvent } from "../types";
import { formatPrice, guardLevelName, guardLevelTone } from "../format";
import Sender from "./Sender";

interface HoverTopBarProps {
  pills: HoverPill[];
  onLocate: (eventId: string) => void;
}

/**
 * 悬停胶囊栏：SC/上船事件在悬停期间以胶囊形式展示于栏顶，
 * 点击胶囊定位到对应事件行并触发闪光提示。
 * pills 为空时返回 null（不占位）。
 */
export default function HoverTopBar({ pills, onLocate }: HoverTopBarProps) {
  if (pills.length === 0) return null;

  return (
    <div
      className="flex h-12 items-center gap-2 overflow-x-auto px-3 py-1.5"
      role="toolbar"
      aria-label="悬停事件胶囊"
    >
      {pills.map((pill) => (
        <PillItem key={pill.eventId} pill={pill} onLocate={onLocate} />
      ))}
    </div>
  );
}

function PillItem({ pill, onLocate }: { pill: HoverPill; onLocate: (eventId: string) => void }) {
  if (pill.kind === "sc") {
    return <ScPill event={pill.event} onLocate={onLocate} />;
  }
  return <GuardPill event={pill.event} onLocate={onLocate} />;
}

function ScPill({ event, onLocate }: { event: LiveEvent; onLocate: (eventId: string) => void }) {
  const colors = event.scColors;
  return (
    <button
      type="button"
      role="button"
      aria-label={`定位醒目留言 ${event.sender.name}`}
      onClick={() => onLocate(event.eventId)}
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:brightness-110"
      style={
        colors
          ? {
              background: `linear-gradient(90deg, ${colors.backgroundStart}, ${colors.backgroundEnd})`,
              color: colors.fontColor,
            }
          : undefined
      }
    >
      <Sender sender={event.sender} compact />
      <span>醒目留言</span>
      {event.price !== undefined && <span>{formatPrice(event.price)}</span>}
    </button>
  );
}

function GuardPill({ event, onLocate }: { event: LiveEvent; onLocate: (eventId: string) => void }) {
  const guard = event.guard;
  const level = guard?.level ?? event.sender.guardLevel ?? 2;
  const tone = guardLevelTone(level);
  const shipName = guardLevelName(level) ?? guard?.name ?? "上船";

  return (
    <button
      type="button"
      role="button"
      aria-label={`定位上船 ${shipName} ${event.sender.name}`}
      onClick={() => onLocate(event.eventId)}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:brightness-110 ${tone.chip} ${tone.text}`}
    >
      <Sender sender={event.sender} compact guardLevel={level} />
      <span>{shipName}</span>
    </button>
  );
}
