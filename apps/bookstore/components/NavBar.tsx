"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import {
  SECTIONS,
  SECTION_CHANGE_EVENT,
  NAVIGATE_EVENT,
  type SectionChangeDetail,
  type NavigateDetail,
} from "@/features/home/sections";
import type { NavKey } from "@/features/home/sections";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cn } from "@/lib/cn";
import type { ToolModule } from "@/lib/tools/registry";

interface NavBarProps {
  siteName: string;
  tools: ToolModule[];
}

interface BaseLink {
  navKey: string;
  label: string;
  /** 首页内锚点 href。 */
  anchor: string;
  /** 独立路由路径（非首页选中态匹配用）。 */
  route: string;
  /** 目标站 id（首页导航翻页用）。 */
  sectionId: string;
  kind: "internal";
}

type NavLink = BaseLink;

/** 从注册表取锚点与独立路由（单一事实源）。 */
function buildBaseLinks(): BaseLink[] {
  const map: Record<NavKey, { label: string; route: string }> = {
    home: { label: "主页", route: "/" },
    archive: { label: "档案", route: "/about" },
    assets: { label: "素材", route: "/assets" },
    calendar: { label: "日历", route: "/calendar" },
  };
  return (Object.keys(map) as NavKey[])
    .filter((k) => k !== "calendar" || API_CONFIGURED)
    .map((navKey) => {
      const first = SECTIONS.find((s) => s.navKey === navKey);
      return {
        navKey,
        label: map[navKey].label,
        anchor: `/#${first?.id ?? ""}`,
        route: map[navKey].route,
        sectionId: first?.id ?? "",
        kind: "internal" as const,
      };
    });
}

const linkClass = (active: boolean) =>
  cn(
    "relative inline-flex min-h-11 items-center text-small tracking-[0.04em] transition-colors duration-(--duration-fast)",
    active
      ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-primary"
      : "text-ink-dim hover:text-ink",
  );

export default function NavBar({ siteName, tools }: NavBarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState<string>("");
  const drawerRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isHome) return;
    const syncHash = () => setHash(window.location.hash);
    const onSectionChange = (e: Event) => {
      const detail = (e as CustomEvent<SectionChangeDetail>).detail;
      if (detail && typeof detail.navKey === "string") {
        setHash(`#${SECTIONS.find((s) => s.navKey === detail.navKey)?.id ?? ""}`);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener(SECTION_CHANGE_EVENT, onSectionChange);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener(SECTION_CHANGE_EVENT, onSectionChange);
    };
  }, [isHome]);

  const close = useCallback(() => setOpen(false), []);
  useFocusTrap(drawerRef, open, { lockScroll: true, onEscape: close });

  const baseLinks = buildBaseLinks();
  const ongoingLinks: BaseLink[] = [
    ...(API_CONFIGURED
      ? [{ navKey: "topics", label: "棉花糖", anchor: "/topics", route: "/topics", sectionId: "", kind: "internal" as const }]
      : []),
    ...(RECORDINGS_CONFIGURED
      ? [{ navKey: "recordings", label: "录播", anchor: "/recordings", route: "/recordings", sectionId: "", kind: "internal" as const }]
      : []),
  ];
  const links: NavLink[] = [
    ...baseLinks,
    ...ongoingLinks,
    ...tools.map((tool) => ({
      navKey: `tool-${tool.slug}`,
      label: tool.name,
      anchor: `/tools/${tool.slug}`,
      route: `/tools/${tool.slug}`,
      sectionId: "",
      kind: "internal" as const,
    })),
  ];

  const isActive = (link: NavLink) => {
    if (isHome) {
      const activeKey = SECTIONS.find((s) => `#${s.id}` === hash)?.navKey ?? (hash ? undefined : "home");
      return link.navKey === activeKey;
    }
    if (link.route === "/") return pathname === "/";
    if (link.route.startsWith("/tools/")) return pathname.startsWith(link.route);
    return pathname === link.route;
  };

  const hrefOf = (link: NavLink) => {
    return link.navKey.startsWith("tool-") ? link.route : link.anchor;
  };

  const handleNavClick = (e: React.MouseEvent, link: NavLink) => {
    if (isHome && link.sectionId) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { id: link.sectionId as NavigateDetail["id"] } }),
      );
      window.history.pushState(null, "", `#${link.sectionId}`);
    }
    setOpen(false);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-(--duration-base)",
        scrolled || open ? "border-line bg-night/90 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full items-center justify-between px-5 lg:px-16">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-base font-semibold tracking-wide text-ink">{siteName}</span>
          <span className="font-display text-sm italic text-primary transition-colors group-hover:text-flower">
            Sumire
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <li key={link.route}>
              <Link
                href={hrefOf(link)}
                onClick={(e) => handleNavClick(e, link)}
                aria-current={isActive(link) ? "page" : undefined}
                className={linkClass(isActive(link))}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center text-ink md:hidden"
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="站点导航"
          className="fixed inset-x-0 bottom-0 top-16 flex flex-col justify-between overflow-y-auto border-t border-line bg-night px-5 pb-8 pt-6 md:hidden"
        >
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.route} className="border-b border-line">
                <Link
                  href={hrefOf(link)}
                  aria-current={isActive(link) ? "page" : undefined}
                  onClick={(e) => handleNavClick(e, link)}
                  className={cn(
                    "flex min-h-14 items-center font-serif text-h2",
                    isActive(link) ? "text-primary" : "text-ink-dim",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="pt-8 text-label text-ink-dim">
            © 2026 堇色书屋 · 非官方粉丝站，素材版权归主播及所属社团所有
          </p>
        </div>
      )}
    </header>
  );
}
