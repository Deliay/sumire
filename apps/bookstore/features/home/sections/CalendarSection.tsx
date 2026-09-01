"use client";

import CalendarViewPage from "@/features/schedule/CalendarViewPage";

/** 日历站：全幅 immersive 月视图（未配置 API 时该站不注册，无需守卫）。 */
export default function CalendarSection() {
  return (
    <section className="flex h-svh flex-col overflow-hidden px-5 py-6 lg:px-10">
      <CalendarViewPage />
    </section>
  );
}