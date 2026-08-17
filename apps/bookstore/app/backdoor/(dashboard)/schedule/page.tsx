"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deletePlan,
  listLiveHistory,
  listPlans,
  type LiveRecord,
  type StreamPlan,
} from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import PlanFormDialog from "@/features/schedule/PlanFormDialog";
import WeeklyImageDialog from "@/features/schedule/weeklyImage/WeeklyImageDialog";
import { mergeEntries } from "@/features/schedule/mergeEntries";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
import { monthRange } from "@/features/schedule/dateUtils";

interface Range {
  from: string;
  to: string;
}

interface FormState {
  open: boolean;
  mode: "create" | "edit";
  plan?: StreamPlan | null;
  preselectDate?: string;
}

/** 当前月份的 from/to 区间（YYYY-MM-DD，含首末）。 */
function currentMonthRange(): Range {
  const now = new Date();
  return monthRange(now.getFullYear(), now.getMonth() + 1);
}

export default function SchedulePage() {
  const { session } = useSession();
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>(() => currentMonthRange());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false, mode: "create" });
  const [formNonce, setFormNonce] = useState(0);
  const [toast, setToast] = useState("");
  const [imageOpen, setImageOpen] = useState(false);

  const canManage = session.status === "authenticated" && atLeast(session.me.role, "admin");

  // 历史直播记录独立加载，失败静默降级（仅展示计划）
  useEffect(() => {
    void (async () => {
      const res = await listLiveHistory();
      if (res.ok) setRecords(res.records);
    })();
  }, []);

  const entries = useMemo(() => mergeEntries(plans, records), [plans, records]);

  const refresh = useCallback(async (r: Range) => {
    const { status, data } = await listPlans(r.from, r.to);
    setLoading(false);
    if (status === 200 && "plans" in data) {
      setPlans(data.plans);
      setError("");
    } else if (status !== 0) {
      setError("加载失败");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const { status, data } = await listPlans(range.from, range.to);
      setLoading(false);
      if (status === 200 && "plans" in data) {
        setPlans(data.plans);
        setError("");
      } else if (status !== 0) {
        setError("加载失败");
      }
    })();
  }, [range.from, range.to]);

  function handleRangeChange(from: string, to: string) {
    setRange({ from, to });
  }

  function handleSaved(plan: StreamPlan) {
    if (selectedDay && plan.date !== selectedDay) {
      const p = plan.date.slice(5);
      const [mm, dd] = p.split("-");
      setToast(`已移至 ${Number(mm)} 月 ${Number(dd)} 日`);
    } else {
      setToast("");
    }
    void refresh(range);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { status } = await deletePlan(id);
    setDeletingId(null);
    if (status === 200) {
      void refresh(range);
    } else {
      setToast("删除失败，请重试");
    }
  }

  function openCreate(preselectDate?: string) {
    setFormNonce((n) => n + 1);
    setForm({ open: true, mode: "create", preselectDate });
  }

  function openEdit(plan: StreamPlan) {
    setFormNonce((n) => n + 1);
    setForm({ open: true, mode: "edit", plan });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">直播计划</h1>
          <p className="mt-1 text-ink-dim">官方日程的日历，历史与未来一览</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImageOpen(true)}
            className="rounded-md border border-vine/50 px-4 py-2 text-sm font-medium text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
          >
            生成周表图片
          </button>
          {canManage && (
            <button
              onClick={() => openCreate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors duration-150 hover:bg-primary-deep"
            >
              增加直播计划
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 min-h-[480px]">
        {error ? (
          <p className="text-sm text-flower">{error}</p>
        ) : loading ? (
          <div className="h-full min-h-64 animate-pulse rounded-md border border-vine/50 bg-raised" aria-busy="true" />
        ) : (
          <CalendarView entries={entries} onRangeChange={handleRangeChange} onSelectDay={setSelectedDay} />
        )}
      </div>

      <DayDetailDialog
        key={selectedDay ?? "none"}
        open={selectedDay !== null}
        date={selectedDay ?? ""}
        entries={selectedDay ? entries.filter((e) => e.date === selectedDay) : []}
        readOnly={!canManage}
        onClose={() => setSelectedDay(null)}
        onAdd={canManage ? () => openCreate(selectedDay ?? undefined) : undefined}
        onEdit={canManage ? openEdit : undefined}
        onDelete={canManage ? handleDelete : undefined}
        deletingId={deletingId}
      />

      <WeeklyImageDialog open={imageOpen} onClose={() => setImageOpen(false)} />

      <PlanFormDialog
        key={formNonce}
        open={form.open}
        mode={form.mode}
        initial={form.plan}
        preselectDate={form.preselectDate}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onSaved={handleSaved}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-md border border-flower/60 bg-raised px-4 py-2 text-sm text-ink shadow-xl">
          {toast}
          <button type="button" className="ml-2 text-ink-dim hover:text-ink" onClick={() => setToast("")}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
