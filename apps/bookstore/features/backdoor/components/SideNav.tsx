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
  { href: "/backdoor/users", label: "用户管理", roles: ["superadmin"] },
];

/** 左侧导航：按角色渲染可见项，选中态描边。 */
export default function SideNav({ role }: SideNavProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="w-full border-r border-vine/50 bg-night lg:w-48" aria-label="后台导航">
      <ul className="flex flex-col gap-1 p-3 lg:sticky lg:top-0">
        {items.map((item) => {
          const active =
            item.href === "/backdoor"
              ? pathname === "/backdoor"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  active
                    ? "border-l-[3px] border-primary bg-soft text-ink"
                    : "border-l-[3px] border-transparent text-ink-dim hover:text-ink"
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
