"use client";

import { useEffect, useState } from "react";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import { monthRange } from "@/features/schedule/dateUtils";

/** 当前月份的 from/to 区间（YYYY-MM-DD，含首末）。 */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

/** 公开日历页主体：客户端按当前月区间拉取，翻月按新区间重新拉取；点击某天只读查看当日安排。 */
export default function CalendarViewPage() {
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    <section className="mx-auto w-full max-w-[80rem] px-5 py-14 lg:px-10">
      <header className="mb-8 text-center">
        <p className="font-display text-sm italic tracking-[0.4em] text-ink-dim">
          Weekly Schedule
        </p>
        <h1 className="mt-2 font-serif text-4xl font-semibold text-ink sm:text-5xl">
          直播日程
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-dim">
          这里记着老书屋里的一场场直播——过去的已落下帷幕，未来的还亮着灯。
        </p>
      </header>
      {error ? (
        <p className="text-center text-sm text-flower">日程暂时翻不开了</p>
      ) : loading ? (
        <div className="min-h-80 animate-pulse rounded-md border border-vine/50 bg-raised" aria-busy="true" />
      ) : (
        <CalendarView plans={plans} onMonthChange={handleMonthChange} onSelectDay={setSelectedDay} />
      )}

      <DayDetailDialog
        open={selectedDay !== null}
        date={selectedDay ?? ""}
        plans={selectedDay ? plans.filter((p) => p.date === selectedDay) : []}
        readOnly
        onClose={() => setSelectedDay(null)}
      />
    </section>
  );
}
