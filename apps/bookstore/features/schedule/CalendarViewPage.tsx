"use client";

import { useEffect, useState } from "react";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import { monthRange } from "@/features/schedule/dateUtils";

/** 当前月份的 from/to 区间（YYYY-MM-DD，含首末）。 */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

/** 公开日历页主体：客户端按当前月区间拉取，翻月按新区间重新拉取。 */
export default function CalendarViewPage() {
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const { from, to } = currentMonthRange();
    void (async () => {
      const { status, data } = await listPlans(from, to);
      setLoading(false);
      if (status === 200 && "plans" in data) {
        setPlans(data.plans);
      } else if (status !== 0) {
        setError("加载失败");
      }
    })();
  }, []);

  function handleMonthChange(from: string, to: string) {
    void (async () => {
      const { status, data } = await listPlans(from, to);
      if (status === 200 && "plans" in data) {
        setPlans(data.plans);
      } else if (status !== 0) {
        setError("加载失败");
      }
    })();
  }

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-14 lg:px-10">
      <header className="mb-8">
        <p className="font-display text-sm italic tracking-[0.35em] text-ink-dim">
          Schedule
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-ink">
          直播日程
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-dim">
          这里记着老书屋里的一场场直播——过去的已落下帷幕，未来的还亮着灯。
        </p>
      </header>
      {error ? (
        <p className="text-sm text-flower">{error}</p>
      ) : loading ? (
        <div className="min-h-80 animate-pulse rounded-md border border-vine/50 bg-raised" aria-busy="true" />
      ) : (
        <CalendarView plans={plans} onMonthChange={handleMonthChange} />
      )}
    </section>
  );
}
