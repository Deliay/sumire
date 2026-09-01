"use client";

import { useEffect, useMemo, useState } from "react";
import { listLiveHistory, listPlans, type LiveRecord, type StreamPlan } from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import { mergeEntries } from "@/features/schedule/mergeEntries";
import { monthGridRange } from "@/features/schedule/dateUtils";

/** 当前月展示网格的 from/to 区间（YYYY-MM-DD，含首末，覆盖跨月补位）。 */
function currentGridRange(): { from: string; to: string } {
  const now = new Date();
  return monthGridRange(now.getFullYear(), now.getMonth() + 1);
}

/** 公开日历页主体：客户端按当前月区间拉取，翻月按新区间重新拉取；点击某天只读查看当日安排。 */
export default function CalendarViewPage({ compact = false }: { compact?: boolean }) {
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = currentGridRange();
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

  // 历史直播记录独立加载，失败静默降级（仅展示计划）
  useEffect(() => {
    void (async () => {
      const res = await listLiveHistory();
      if (res.ok) setRecords(res.records);
    })();
  }, []);

  const entries = useMemo(() => mergeEntries(plans, records), [plans, records]);

  function handleRangeChange(from: string, to: string) {
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
    <section className={`flex h-full w-full flex-col ${compact ? "" : "mx-auto w-full px-5 py-14 lg:px-10"}`}>
      {!compact && (
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
      )}
      {error ? (
        <p className="text-center text-sm text-flower">日程暂时翻不开了</p>
      ) : loading ? (
        <div className={`animate-pulse rounded-md border border-vine/50 bg-raised ${compact ? "h-full" : "min-h-80"}`} aria-busy="true" />
      ) : (
        <CalendarView entries={entries} onRangeChange={handleRangeChange} onSelectDay={setSelectedDay} variant="immersive" />
      )}

      <DayDetailDialog
        open={selectedDay !== null}
        date={selectedDay ?? ""}
        entries={selectedDay ? entries.filter((e) => e.date === selectedDay) : []}
        readOnly
        onClose={() => setSelectedDay(null)}
      />
    </section>
  );
}
