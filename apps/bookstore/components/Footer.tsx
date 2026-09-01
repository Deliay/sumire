import { ExternalLink } from "lucide-react";
import type { Site } from "@/lib/content";

interface FooterProps {
  site: Site;
}

export default function Footer({ site }: FooterProps) {
  const links = [
    { href: site.links.bilibili, label: "B 站空间" },
    { href: site.links.live, label: "直播间" },
    { href: site.links.moegirl, label: "萌娘百科" },
  ];

  return (
    <footer className="mt-24">
      <div className="lace-x" aria-hidden />
      <div className="bg-raised">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-6 text-sm lg:px-10">
          <span className="hidden text-ink-dim sm:inline">{site.disclaimer}</span>
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