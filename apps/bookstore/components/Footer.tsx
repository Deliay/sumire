import { ExternalLink } from "lucide-react";
import type { Site } from "@/lib/content";

export default function Footer({ site }: { site: Site }) {
  return (
    <footer className="mt-24">
      <div className="lace-x" aria-hidden />
      <div className="bg-raised">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 lg:px-10">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
            {site.disclaimer}
          </p>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <a
              href={site.links.bilibili}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-dim transition-colors hover:text-flower"
            >
              B 站空间 <ExternalLink size={14} />
            </a>
            <a
              href={site.links.live}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-dim transition-colors hover:text-flower"
            >
              直播间 <ExternalLink size={14} />
            </a>
            <a
              href={site.links.moegirl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ink-dim transition-colors hover:text-flower"
            >
              萌娘百科 <ExternalLink size={14} />
            </a>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-dim">
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: site.color }}
              aria-hidden
            />
            <span>应援色 {site.color}</span>
            <span aria-hidden>·</span>
            <span>
              {site.name} · {site.tagline}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
