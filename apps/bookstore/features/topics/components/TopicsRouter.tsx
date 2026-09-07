"use client";

import { useSearchParams } from "next/navigation";
import TopicPublicPage from "@/features/topics/components/TopicPublicPage";
import TopicsOngoingPage from "@/features/topics/components/TopicsOngoingPage";

// round 9：/topics 按是否有 id 查询串分派——有 id → 收集页，无 id → 进行中列表页
export default function TopicsRouter() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return id ? <TopicPublicPage /> : <TopicsOngoingPage />;
}