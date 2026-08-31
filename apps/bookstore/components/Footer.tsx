import { ExternalLink } from "lucide-react";
import type { Site } from "@/lib/content";

interface FooterProps {
  site: Site;
  /** 首页贴边呈现：以绝对定位容器承载，保持一行且无顶部蕾丝与抬升面。 */
  floating?: boolean;
}

export default function Footer({ site, floating = false }: FooterProps) {
  const links = [
    { href: site.links.bilibili, label: "B 站空间" },
    { href: site.links.live, label: "直播间" },
    { href: site.links.moegirl, label: "萌娘百科" },
  ];

  return (
    <footer className={floating ? "w-fit" : "mt-24"}>
      {!floating && <div className="lace-x" aria-hidden />}
      <div className={floating ? "" : "bg-raised"}>
        <div
          className={
            floating
              ? "flex w-fit flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              : "mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 text-sm lg:px-10"
          }
        >
          <span className="hidden text-ink-dim sm:inline">
            {site.disclaimer}
          </span>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ink-dim transition-colors hover:text-flower"
            >
              {link.label} <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
