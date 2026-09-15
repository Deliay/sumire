"use client";

import CalendarViewPage from "@/features/schedule/CalendarViewPage";

/** 日历站：全幅 immersive 月视图（compact 去页头防矮视口裁剪；未配置 API 时该站不注册）。 */
export default function CalendarSection() {
  return (
    <section
      data-fullpage-scrollable
      className="flex h-svh flex-col overflow-y-auto overflow-x-hidden px-4 pb-3 pt-20 lg:px-6"
    >
      <CalendarViewPage compact />
    </section>
  );
}