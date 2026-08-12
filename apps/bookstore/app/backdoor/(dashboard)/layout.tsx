"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/features/backdoor/session";
import { logout } from "@/features/backdoor/api";
import TopBar from "@/features/backdoor/components/TopBar";
import SideNav from "@/features/backdoor/components/SideNav";
import GuardLoading from "@/features/backdoor/components/GuardLoading";

/** 后台仪表盘布局：顶部栏 + 左侧导航 + 内容区。 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { session, clear } = useSession();
  const router = useRouter();

  if (session.status !== "authenticated") {
    return <GuardLoading />;
  }

  async function handleLogout() {
    await logout();
    clear();
    router.replace("/backdoor/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <TopBar
        username={session.me.username}
        role={session.me.role}
        onLogout={handleLogout}
      />
      <div className="flex flex-1 flex-col lg:flex-row">
        <SideNav role={session.me.role} />
        <main className="flex-1 px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
