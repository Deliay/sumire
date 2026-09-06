import type { Metadata } from "next";
import { Suspense } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";
import TopicPublicPage from "@/features/topics/components/TopicPublicPage";

export const metadata: Metadata = {
  title: "投递棉花糖 · 枝堇",
};

// B8: GitHub Pages 静态导出不支持动态路由直达
// 降级为查询串方案：/topics?id={topicId}，客户端经 useSearchParams 读取
export default function TopicsPublicPage() {
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  return (
    <Suspense fallback={null}>
      <TopicPublicPage />
    </Suspense>
  );
}