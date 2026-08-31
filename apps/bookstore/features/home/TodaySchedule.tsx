"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import { toDateStr } from "@/features/schedule/dateUtils";

/** 本地时区当天 YYYY-MM-DD（与日历页口径一致）。 */
function todayStr(): string {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

type State =
  | { kind: "loading" }
  | { kind: "loaded"; plans: StreamPlan[] };

/**
 * 今日日程组件：展示当天直播计划（时间 + 主题），无计划展示空态。
 * 仅在 API_CONFIGURED 时挂载；未配置返回 null 不留占位。
 */
export default function TodaySchedule() {
  const today = useMemo(() => todayStr(), []);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!API_CONFIGURED) return;
    let active = true;
    void (async () => {
      try {
        const { status, data } = await listPlans(today, today);
        if (!active) return;
        if (status === 200 && "plans" in data) {
          setState({ kind: "loaded", plans: data.plans });
        } else {
          setState({ kind: "loaded", plans: [] });
        }
      } catch {
        if (active) setState({ kind: "loaded", plans: [] });
      }
    })();
    return () => {
      active = false;
    };
  }, [today]);

  if (!API_CONFIGURED) {
    return null;
  }

  const plans = state.kind === "loaded" ? state.plans : [];
  const sorted = [...plans].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="w-fit rounded-lg border border-vine/40 bg-raised/60 p-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-primary" aria-hidden />
        <h2 className="font-serif text-base font-semibold text-ink">今日日程</h2>
      </div>
      {state.kind === "loading" ? (
        <div className="mt-2 h-5 w-40 animate-pulse rounded bg-soft" aria-busy="true" />
      ) : sorted.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="tabular-nums text-ink-dim">{p.startTime}</span>
              <span className="text-ink">{p.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-ink-dim">今日暂无安排</p>
      )}
    </div>
  );
}
