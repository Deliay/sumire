import { cn } from "@/lib/cn";

export interface TimelineItem {
  key: string;
  /** ISO 日期（YYYY-MM-DD），用于 <time dateTime>。 */
  date: string;
  title: string;
  note?: string;
  /** 最新/当前项：日期使用 primary。 */
  current?: boolean;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

/** 编辑体年表：桌面日期列 8rem 右对齐 + 内容列；移动单列。 */
export default function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-1 gap-1 border-b border-line py-4 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:py-5"
        >
          <time
            dateTime={item.date}
            className={cn(
              "font-mono text-label tabular-nums sm:text-right",
              item.current ? "text-primary" : "text-ink-dim",
            )}
          >
            {item.date}
          </time>
          <div className="flex flex-col gap-1">
            <h3 className="font-serif text-h3 font-semibold text-ink">{item.title}</h3>
            {item.note ? <p className="text-small leading-relaxed text-ink-dim">{item.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
