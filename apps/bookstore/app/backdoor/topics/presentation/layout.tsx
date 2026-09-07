import { redirect } from "next/navigation";
import { API_CONFIGURED } from "@/features/backdoor/api";

// B7: 幻灯片页独立布局，不经 (dashboard) 布局
// 客户端会话/权限守卫在页面组件内处理

export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!API_CONFIGURED) {
    redirect("/backdoor");
  }
  return <>{children}</>;
}