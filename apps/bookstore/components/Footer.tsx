import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import type { Site } from "@/lib/content";

interface FooterProps {
  site: Site;
}

/** 版权页式页脚：站点说明 / 导航 / 关注 三栏，顶部 1px 线。 */
export default function Footer({ site }: FooterProps) {
  const navLinks = [
    { href: "/", label: "主页" },
    { href: "/about", label: "档案" },
    { href: "/assets", label: "素材" },
    ...(API_CONFIGURED
      ? [
          { href: "/calendar", label: "日历" },
          { href: "/topics", label: "棉花糖" },
        ]
      : []),
    ...(RECORDINGS_CONFIGURED ? [{ href: "/recordings", label: "录播" }] : []),
  ];
  const externalLinks = [
    { href: site.links.bilibili, label: "B 站空间" },
    { href: site.links.live, label: "直播间" },
    { href: site.links.moegirl, label: "萌娘百科" },
    { href: site.links.secretRoom, label: "小密室" },
  ];

  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 gap-10 px-5 py-12 sm:grid-cols-3 lg:px-16">
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-h3 font-semibold text-ink">{site.name}</h2>
          <p className="text-small leading-relaxed text-ink-dim">{site.disclaimer}</p>
          <p className="font-mono text-label text-ink-dim">应援色 {site.color}</p>
        </section>

        <nav aria-label="页脚导航" className="flex flex-col gap-2">
          <h2 className="font-mono text-label tracking-label uppercase text-ink-dim">站点</h2>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-small text-ink transition-colors duration-(--duration-fast) hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="官方链接" className="flex flex-col gap-2">
          <h2 className="font-mono text-label tracking-label uppercase text-ink-dim">关注</h2>
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-small text-ink transition-colors duration-(--duration-fast) hover:text-primary"
            >
              {link.label} <ExternalLink size={14} aria-hidden />
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto w-full max-w-[88rem] border-t border-line px-5 py-5 lg:px-16">
        <p className="font-mono text-tiny text-ink-dim">© 2026 堇色书屋 · Sumire Fan Site</p>
      </div>
    </footer>
  );
}
