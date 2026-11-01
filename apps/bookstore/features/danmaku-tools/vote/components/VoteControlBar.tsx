"use client";

import Button from "@/components/ui/Button";

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
          <Button variant="danger" size="sm" onClick={onStop}>
            停止投票
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onStart}>
            开始投票
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClear}>
          清空投票
        </Button>
      </div>
    </div>
  );
}
