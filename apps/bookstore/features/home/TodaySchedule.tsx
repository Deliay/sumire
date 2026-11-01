"use client";

import { useEffect, useMemo, useState } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import { toDateStr } from "@/features/schedule/dateUtils";
import { comparePlans, planTimeSlot } from "@/features/schedule/timeType";

/** 本地时区当天 YYYY-MM-DD（与日历页口径一致）。 */
function todayStr(): string {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

type State =
  | { kind: "loading" }
  | { kind: "loaded"; plans: StreamPlan[] };

/**
 * 今日日程：行内元数据（时间 + 主题），无计划展示空态文案。
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

  if (!API_CONFIGURED) return null;

  const plans = state.kind === "loaded" ? state.plans : [];
  const sorted = [...plans].sort(comparePlans);

  if (state.kind === "loading") {
    return <span className="inline-block h-5 w-40 animate-pulse rounded-xs bg-soft" aria-busy="true" />;
  }

  if (sorted.length === 0) {
    return <span className="text-small text-ink-dim">今日暂无安排</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {sorted.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-2 text-small">
          <span className="font-mono tabular-nums text-ink-dim">{planTimeSlot(p)}</span>
          <span className="text-ink">{p.title}</span>
        </span>
      ))}
    </span>
  );
}
