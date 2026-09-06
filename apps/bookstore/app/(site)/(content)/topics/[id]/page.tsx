import type { Metadata } from "next";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";
import TopicPublicPage from "@/features/topics/components/TopicPublicPage";

export const metadata: Metadata = {
  title: "投递棉花糖 · 枝堇",
};

export function generateStaticParams() {
  return [{ id: "_" }];
}

export const dynamicParams = false;

export default function TopicsPublicPage() {
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  return <TopicPublicPage />;
}
