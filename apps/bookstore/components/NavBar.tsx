"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { SECTIONS } from "@/features/home/sections";
import type { ToolModule } from "@/lib/tools/registry";

interface NavBarProps {
  siteName: string;
  tools: ToolModule[];
}

/** 从注册表取锚点 href（单一事实源）。 */
function buildBaseLinks(): { href: string; label: string; navKey: string }[] {
  const nav = [
    { navKey: "home", label: "主页" },
    { navKey: "archive", label: "档案" },
    { navKey: "assets", label: "素材" },
    ...(API_CONFIGURED ? [{ navKey: "calendar", label: "日历" }] : []),
  ];
  return nav.map(({ navKey, label }) => {
    const first = SECTIONS.find((s) => s.navKey === navKey);
    return { href: `/#${first?.id ?? ""}`, label, navKey };
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

  // 首页路由下跟踪 hash 选中态（档案 P1~P5 均视为「档案」）
  useEffect(() => {
    if (!isHome) return;
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [isHome]);

  const links = [
    ...buildBaseLinks(),
    ...tools.map((tool) => ({
      href: `/tools/${tool.slug}`,
      label: tool.name,
      navKey: `tool-${tool.slug}`,
    })),
  ];

  const isActive = (link: { href: string; navKey: string }) => {
    if (isHome) {
      // 首页：按 hash 匹配 navKey；无 hash 时主页选中
      const activeKey = SECTIONS.find((s) => `#${s.id}` === hash)?.navKey ?? (hash ? undefined : "home");
      return link.navKey === activeKey;
    }
    // 非首页：按既有 pathname 口径
    return link.href === "/" ? pathname === "/" : pathname.startsWith(link.href.split("#")[0]!);
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
            <li key={link.href}>
              <Link
                href={link.href}
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
            <li key={link.href} className="py-2">
              <Link
                href={link.href}
                aria-current={isActive(link) ? "page" : undefined}
                onClick={() => setOpen(false)}
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