"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { SECTIONS, SECTION_CHANGE_EVENT, NAVIGATE_EVENT, type SectionChangeDetail, type NavigateDetail } from "@/features/home/sections";
import type { NavKey } from "@/features/home/sections";
import type { ToolModule } from "@/lib/tools/registry";

interface NavBarProps {
  siteName: string;
  tools: ToolModule[];
}

interface BaseLink {
  navKey: NavKey;
  label: string;
  /** 首页内锚点 href。 */
  anchor: string;
  /** 独立路由路径（非首页选中态匹配用）。 */
  route: string;
  /** 目标站 id（首页导航翻页用）。 */
  sectionId: string;
}

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
      return { navKey, label: map[navKey].label, anchor: `/#${first?.id ?? ""}`, route: map[navKey].route, sectionId: first?.id ?? "" };
    });
}

export default function NavBar({ siteName, tools }: NavBarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState<string>("");

  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 首页路由下跟踪 hash 选中态：监听 hashchange（外部跳转）与 SECTION_CHANGE_EVENT（deck 翻页 replaceState）
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

  const baseLinks = buildBaseLinks();
  // round 9：独立路由「棉花糖」入口（/topics 进行中列表页），不走首页 deck 锚点翻页；仅 API 已配置时显示
  const ongoingLink = API_CONFIGURED
    ? [{ navKey: "topics" as string, label: "棉花糖", anchor: "/topics", route: "/topics" }]
    : [];
  const links = [
    ...baseLinks,
    ...ongoingLink,
    ...tools.map((tool) => ({
      navKey: `tool-${tool.slug}` as string,
      label: tool.name,
      anchor: `/tools/${tool.slug}`,
      route: `/tools/${tool.slug}`,
    })),
  ];

  const isActive = (link: { navKey: string; route: string; anchor: string }) => {
    if (isHome) {
      const activeKey = SECTIONS.find((s) => `#${s.id}` === hash)?.navKey ?? (hash ? undefined : "home");
      return link.navKey === activeKey;
    }
    // 非首页：按独立路由精确匹配（工具项前缀匹配）
    if (link.route === "/") return pathname === "/";
    if (link.route.startsWith("/tools/")) return pathname.startsWith(link.route);
    return pathname === link.route;
  };

  // 基础导航恒为锚点 href（首页/非首页均指向首页对应锚点，deck 挂载时 hash 直落定位）；工具项为独立路由
  const hrefOf = (link: { navKey: string; route: string; anchor: string }) =>
    link.navKey.startsWith("tool-") ? link.route : link.anchor;

  // 首页内点击导航：Next Link 到 #hash 用 pushState 不触发 hashchange，改派发 NAVIGATE_EVENT 交由 deck 平滑翻页
  const handleNavClick = (e: React.MouseEvent, link: { sectionId?: string; navKey: string }) => {
    if (isHome && link.sectionId) {
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent<NavigateDetail>(NAVIGATE_EVENT, { detail: { id: link.sectionId as NavigateDetail["id"] } }),
      );
      window.history.pushState(null, "", `#${link.sectionId}`);
      setOpen(false);
    }
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-500 ${
        scrolled || open
          ? "bg-night/85 shadow-[0_1px_0_0_var(--color-vine)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 w-full items-center justify-between px-5 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-lg font-semibold tracking-wide text-ink">
            {siteName}
          </span>
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
                className={`text-sm tracking-widest transition-colors ${
                  isActive(link)
                    ? "text-primary"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="text-ink md:hidden"
          aria-label={open ? "关闭菜单" : "打开菜单"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <ul className="border-t border-vine/40 bg-night/95 px-5 py-4 backdrop-blur-md md:hidden">
          {links.map((link) => (
            <li key={link.route} className="py-2">
              <Link
                href={hrefOf(link)}
                aria-current={isActive(link) ? "page" : undefined}
                onClick={(e) => handleNavClick(e, link)}
                className={`block text-base tracking-widest ${
                  isActive(link) ? "text-primary" : "text-ink-dim"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}