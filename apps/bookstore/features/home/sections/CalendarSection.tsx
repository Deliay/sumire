"use client";

import CalendarViewPage from "@/features/schedule/CalendarViewPage";

/** 日历站：全幅 immersive 月视图（compact 去页头防矮视口裁剪；未配置 API 时该站不注册）。 */
export default function CalendarSection() {
  return (
    <section className="flex h-svh flex-col overflow-hidden px-4 py-3 lg:px-6">
      <CalendarViewPage compact />
    </section>
  );
}