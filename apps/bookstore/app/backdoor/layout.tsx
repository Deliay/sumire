import type { Metadata } from "next";
import { SessionProvider } from "@/features/backdoor/session";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";

export const metadata: Metadata = {
  title: "后台 · 枝堇",
};

export default function BackdoorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 未配置后台 API 基址时直接渲染站点风格 404，确保 SessionProvider 不进入组件树、
  // 客户端会话守卫不被挂载，从而不产生任何发往主站自身的 /api/* 请求。
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  return <SessionProvider>{children}</SessionProvider>;
}
