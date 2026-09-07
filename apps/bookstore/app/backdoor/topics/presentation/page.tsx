import { Suspense } from "react";
import PresentationView from "@/features/topics/components/PresentationView";

// B8 同款方案：静态导出不支持动态路由直达，幻灯片页改用查询串 id（/backdoor/topics/presentation?id=xxx）
export default function PresentationPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-night text-ink-dim">加载中…</div>}>
      <PresentationView />
    </Suspense>
  );
}