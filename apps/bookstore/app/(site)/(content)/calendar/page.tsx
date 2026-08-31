import type { Metadata } from "next";
import { API_CONFIGURED } from "@/features/backdoor/api";
import NotFoundPage from "@/components/NotFoundPage";
import CalendarViewPage from "@/features/schedule/CalendarViewPage";

export const metadata: Metadata = {
  title: "直播日程 · 枝堇",
};

export default function CalendarPage() {
  if (!API_CONFIGURED) {
    return <NotFoundPage />;
  }
  return <CalendarViewPage />;
}
