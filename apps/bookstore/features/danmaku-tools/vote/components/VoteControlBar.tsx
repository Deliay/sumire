"use client";

interface VoteControlBarProps {
  voting: boolean;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
}

export default function VoteControlBar({
  voting,
  onStart,
  onStop,
  onClear,
}: VoteControlBarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {voting ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-md bg-crimson px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors hover:bg-crimson/80"
          >
            停止投票
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors hover:bg-primary/80"
          >
            开始投票
          </button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-vine/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-raised"
        >
          清空投票
        </button>
      </div>
    </div>
  );
}
