"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/backdoor/session";
import type { Role } from "@/features/backdoor/api";
import GuardLoading from "@/features/backdoor/components/GuardLoading";

const RANK: Record<Role, number> = { superadmin: 2, admin: 1, member: 0 };

interface RequireRoleProps {
  /** 所需最小角色层级 */
  role: Role;
  children: ReactNode;
}

/** 权限守卫：会话角色不足时跳回仪表盘。仅作体验层，接口独立鉴权。 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.status === "authenticated" && RANK[session.me.role] < RANK[role]) {
      router.replace("/backdoor");
    }
  }, [session, role, router]);

  if (session.status !== "authenticated") return <GuardLoading />;
  if (RANK[session.me.role] < RANK[role]) return <GuardLoading />;
  return <>{children}</>;
}
