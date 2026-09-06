import type { Metadata } from "next";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";
import TopicPublicPage from "@/features/topics/components/TopicPublicPage";

export const metadata: Metadata = {
  title: "投递棉花糖 · 枝堇",
};

// B8: GitHub Pages 静态导出不支持动态路由直达
// 降级为查询串方案：/topics?id={topicId}
// 用户分享链接格式为 /topics?id=xxx，页面从 searchParams 读取 id
export default async function TopicsPublicPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  const params = await searchParams;
  return <TopicPublicPage topicId={params.id} />;
}
