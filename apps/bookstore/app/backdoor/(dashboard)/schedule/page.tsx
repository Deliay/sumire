"use client";

import { useCallback, useEffect, useState } from "react";
import { deletePlan, listPlans, type StreamPlan } from "@/features/schedule/api";
import CalendarView from "@/features/schedule/CalendarView";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import PlanFormDialog from "@/features/schedule/PlanFormDialog";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>(() => currentMonthRange());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ open: false, mode: "create" });
  const [formNonce, setFormNonce] = useState(0);
  const [toast, setToast] = useState("");

  const canManage = session.status === "authenticated" && atLeast(session.me.role, "admin");

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

  function handleMonthChange(from: string, to: string) {
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
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">直播计划</h1>
          <p className="mt-1 text-ink-dim">官方日程的日历，历史与未来一览</p>
        </div>
        {canManage && (
          <button
            onClick={() => openCreate()}
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
        <CalendarView plans={plans} onMonthChange={handleMonthChange} onSelectDay={setSelectedDay} />
      )}

      <DayDetailDialog
        key={selectedDay ?? "none"}
        open={selectedDay !== null}
        date={selectedDay ?? ""}
        plans={selectedDay ? plans.filter((p) => p.date === selectedDay) : []}
        readOnly={!canManage}
        onClose={() => setSelectedDay(null)}
        onAdd={canManage ? () => openCreate(selectedDay ?? undefined) : undefined}
        onEdit={canManage ? openEdit : undefined}
        onDelete={canManage ? handleDelete : undefined}
        deletingId={deletingId}
      />

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
