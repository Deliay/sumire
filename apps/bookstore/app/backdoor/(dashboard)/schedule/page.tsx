"use client";

import { useEffect, useState } from "react";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import CreatePlanDialog from "@/features/schedule/CreatePlanDialog";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
import { monthRange } from "@/features/schedule/dateUtils";

/** 当前月份的 from/to 区间（YYYY-MM-DD，含首末）。 */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

export default function SchedulePage() {
  const { session } = useSession();
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const canCreate = session.status === "authenticated" && atLeast(session.me.role, "admin");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">直播计划</h1>
          <p className="mt-1 text-ink-dim">官方日程的日历，历史与未来一览</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors duration-150 hover:bg-primary-deep"
          >
            增加直播计划
          </button>
        )}
      </div>
      {error ? (
        <p className="text-sm text-flower">{error}</p>
      ) : loading ? (
        <div className="min-h-64 animate-pulse rounded-md border border-vine/50 bg-raised" aria-busy="true" />
      ) : (
        <CalendarView plans={plans} onMonthChange={handleMonthChange} />
      )}
      <CreatePlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(plan) => {
          setPlans((prev) => [...prev, { ...plan, createdAt: new Date().toISOString() }]);
        }}
      />
    </div>
  );
}
