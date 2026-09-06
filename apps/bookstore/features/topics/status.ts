import type { TopicStatus } from "./types";

const STATUS_TEXT: Record<TopicStatus, string> = {
  upcoming: "未开始",
  collecting: "进行中",
  ended: "已结束",
};

const STATUS_COLOR: Record<TopicStatus, string> = {
  upcoming: "border-primary",
  collecting: "border-flower",
  ended: "border-ink-dim",
};

export function getStatusText(status: TopicStatus): string {
  return STATUS_TEXT[status];
}

export function getStatusBadgeClass(status: TopicStatus): string {
  return `inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${STATUS_COLOR[status]}`;
}
