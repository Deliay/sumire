import { Suspense } from "react";
import TopicDetailView from "@/features/topics/components/TopicDetailView";

// B8 同款方案：静态导出不支持动态路由直达，详情页改用查询串 id（/backdoor/topics/detail?id=xxx）
export default function TopicDetailPage() {
  return (
    <Suspense fallback={<div className="text-center text-ink-dim py-8">加载中…</div>}>
      <TopicDetailView />
    </Suspense>
  );
}