import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

interface EntryCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  external?: boolean;
  /** 角标小字（如直播状态） */
  badge?: string;
}

/**
 * 主页入口卡片：深色抬升面，hover 时蕾丝顶边浮现 + 轻微上浮。
 */
export default function EntryCard({
  href,
  title,
  description,
  icon: Icon,
  external = false,
  badge,
}: EntryCardProps) {
  const inner = (
    <>
      <div
        className="lace-x opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between">
          <Icon size={22} className="text-primary" aria-hidden />
          {badge && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-dim">
              <span
                className="inline-block size-1.5 rounded-full bg-eye"
                aria-hidden
              />
              {badge}
            </span>
          )}
        </div>
        <h3 className="flex items-center gap-1.5 font-serif text-lg font-semibold text-ink">
          {title}
          {external && (
            <ExternalLink size={14} className="text-ink-dim" aria-hidden />
          )}
        </h3>
        <p className="text-sm leading-relaxed text-ink-dim">{description}</p>
      </div>
    </>
  );

  const className =
    "group block overflow-hidden rounded-lg border border-vine/50 bg-raised transition-all duration-300 hover:-translate-y-0.5 hover:border-flower/70";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
