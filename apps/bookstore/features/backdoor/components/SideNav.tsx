"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/features/backdoor/api";

interface SideNavProps {
  role: Role;
}

interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/backdoor", label: "仪表盘", roles: ["superadmin", "admin", "member"] },
  { href: "/backdoor/schedule", label: "直播计划", roles: ["superadmin", "admin", "member"] },
  { href: "/backdoor/danmaku", label: "弹幕看板", roles: ["superadmin", "admin", "member"] },
  { href: "/backdoor/danmaku/search", label: "弹幕检索", roles: ["superadmin", "admin", "member"] },
  { href: "/backdoor/danmaku-tools", label: "弹幕工具", roles: ["superadmin", "admin", "member"] },
  { href: "/backdoor/topics", label: "棉花糖", roles: ["superadmin", "admin"] },
  { href: "/backdoor/users", label: "用户管理", roles: ["superadmin"] },
];

/** 左侧导航：200px + 右 1px line；活动态 soft 底 + 左 2px primary。 */
export default function SideNav({ role }: SideNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="w-full border-r border-line bg-night lg:w-[200px]" aria-label="后台导航">
      <ul className="flex flex-col gap-0.5 p-3 lg:sticky lg:top-0">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-11 items-center border-l-2 px-3 text-small transition-colors duration-(--duration-fast) ${
                  active
                    ? "border-primary bg-soft text-ink"
                    : "border-transparent text-ink-dim hover:bg-soft/60 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
