"use client";

import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { getStatusText, getStatusBadgeClass } from "@/features/topics/status";
import type { TopicStatus } from "@/features/topics/types";

interface TopicCardProps {
  id: string;
  title: string;
  status: TopicStatus;
  archived?: boolean;
  onRestore?: () => void;
  onStartStop?: () => void;
  onArchive?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
}

export default function TopicCard({
  title,
  status,
  archived,
  onRestore,
  onStartStop,
  onArchive,
  onEdit,
  onClick,
}: TopicCardProps) {
  return (
    <Surface
      padding="sm"
      className="cursor-pointer transition-colors duration-(--duration-fast) hover:border-line-strong"
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="truncate font-serif text-h3 font-semibold text-ink">{title}</h3>
        <span className={getStatusBadgeClass(status)}>{getStatusText(status)}</span>
      </div>
      {/* round 9：已归档卡片操作行仅「恢复」 */}
      {archived ? (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onRestore}>
            恢复
          </Button>
        </div>
      ) : (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onStartStop}>
            {status === "collecting" ? "停止收集" : "继续收集"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onArchive}>
            归档
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            修改
          </Button>
        </div>
      )}
    </Surface>
  );
}
