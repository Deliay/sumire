interface OnlineCountTextProps {
  onlineCount: number | null;
}

export function OnlineCountText({ onlineCount }: OnlineCountTextProps) {
  if (onlineCount == null) return null;
  return (
    <span className="text-sm font-normal text-ink-dim">
      当前直播间在线 {onlineCount} 人
    </span>
  );
}
