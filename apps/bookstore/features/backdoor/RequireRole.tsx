"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/backdoor/session";
import type { Role } from "@/features/backdoor/api";
import GuardLoading from "@/features/backdoor/components/GuardLoading";
import { atLeast } from "@/features/backdoor/roleAccess";

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
    if (session.status === "authenticated" && !atLeast(session.me.role, role)) {
      router.replace("/backdoor");
    }
  }, [session, role, router]);

  if (session.status !== "authenticated") return <GuardLoading />;
  if (!atLeast(session.me.role, role)) return <GuardLoading />;
  return <>{children}</>;
}
