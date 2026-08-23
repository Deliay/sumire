interface OnlineCountTextProps {
  onlineCount: number | null;
}

export function OnlineCountText({ onlineCount }: OnlineCountTextProps) {
  if (onlineCount == null) return null;
  return (
    <span className="text-sm font-normal text-ink-dim">
      当前有 {onlineCount} 考子在线
    </span>
  );
}
