"use client";

import { getStatusText, getStatusBadgeClass } from "@/features/topics/status";
import type { TopicStatus } from "@/features/topics/types";

interface TopicCardProps {
  id: string;
  title: string;
  status: TopicStatus;
  onStartStop?: () => void;
  onArchive?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
}

export default function TopicCard({
  title,
  status,
  onStartStop,
  onArchive,
  onEdit,
  onClick,
}: TopicCardProps) {
  return (
    <div
      className="rounded-lg border border-vine bg-raised p-4 cursor-pointer transition-colors duration-150 hover:border-primary"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-ink truncate">{title}</h3>
        <span className={getStatusBadgeClass(status)}>{getStatusText(status)}</span>
      </div>
      <div className="flex gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onStartStop}
          className="text-ink-dim hover:text-ink border border-vine rounded px-2 py-1 transition-colors duration-150"
        >
          {status === "collecting" ? "停止收集" : "继续收集"}
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="text-ink-dim hover:text-ink border border-vine rounded px-2 py-1 transition-colors duration-150"
        >
          归档
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="text-ink-dim hover:text-ink border border-vine rounded px-2 py-1 transition-colors duration-150"
        >
          修改
        </button>
      </div>
    </div>
  );
}
