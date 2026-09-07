import type { Metadata } from "next";
import { Suspense } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";
import TopicsRouter from "@/features/topics/components/TopicsRouter";

export const metadata: Metadata = {
  title: "投递棉花糖 · 枝堇",
};

// B8: GitHub Pages 静态导出不支持动态路由直达
// 降级为查询串方案：/topics?id={topicId}，客户端经 useSearchParams 读取
// round 9：无 id 查询串时渲染「进行中的棉花糖」列表（TopicsOngoingPage）
export default function TopicsPublicPage() {
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  return (
    <Suspense fallback={null}>
      <TopicsRouter />
    </Suspense>
  );
}