import { ExternalLink } from "lucide-react";
import type { Site } from "@/lib/content";

interface FooterProps {
  site: Site;
  /** 首页通栏贴底毛玻璃条：占满宽度、免责声明全端展示、无顶部蕾丝与抬升面。 */
  floating?: boolean;
}

export default function Footer({ site, floating = false }: FooterProps) {
  const links = [
    { href: site.links.bilibili, label: "B 站空间" },
    { href: site.links.live, label: "直播间" },
    { href: site.links.moegirl, label: "萌娘百科" },
  ];

  return (
    <footer
      className={
        floating
          ? "w-full border-t border-vine/30 bg-night/70 backdrop-blur-md"
          : "mt-24"
      }
    >
      {!floating && <div className="lace-x" aria-hidden />}
      <div className={floating ? "" : "bg-raised"}>
        <div
          className={
            floating
              ? "flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm lg:px-10"
              : "mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 text-sm lg:px-10"
          }
        >
          <span
            className={
              floating
                ? "block text-ink-dim"
                : "hidden text-ink-dim sm:inline"
            }
          >
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
