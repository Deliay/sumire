"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { listPlans, type StreamPlan } from "@/features/schedule/api";
import { toDateStr } from "@/features/schedule/dateUtils";
import VineDivider from "@/components/VineDivider";

const WEEK_LABEL = ["一", "二", "三", "四", "五", "六", "日"] as const;

/** 本周（周一~周日）起始的 YYYY-MM-DD 字符串。 */
function weekRange(): { from: string; to: string } {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 周一=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: toDateStr(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
    to: toDateStr(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()),
  };
}

function dayKey(base: Date, offset: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 主页「本周日程」入口区块：周条列氛围，点击进入 /calendar。 */
export default function WeeklySchedule() {
  const range = useMemo(() => weekRange(), []);
  const [plans, setPlans] = useState<StreamPlan[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { status, data } = await listPlans(range.from, range.to);
      if (!active) return;
      if (status === 200 && "plans" in data) {
        setPlans(data.plans);
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [range.from, range.to]);

  const mondayBase = useMemo(() => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    return monday;
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-14 lg:px-10">
      <div className="paper relative overflow-hidden rounded-md p-6 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.6)] sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 opacity-30">
          <CalendarDays size={120} className="text-flower" />
        </div>
        <div className="relative">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-display text-sm italic tracking-[0.3em] text-ink-on-paper/60">
                This Week
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-ink-on-paper">
                本周日程
              </h2>
            </div>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1 text-sm text-ink-on-paper/70 underline decoration-flower decoration-2 underline-offset-4 transition-colors hover:text-ink-on-paper"
            >
              查看完整日历 →
            </Link>
          </div>

          <VineDivider grow={false} className="my-5 h-8" />

          {!loaded ? (
            <div className="grid gap-2" aria-busy="true">
              {WEEK_LABEL.map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-paper-dim/50" />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {WEEK_LABEL.map((label, i) => {
                const key = dayKey(mondayBase, i);
                const dayPlans = plans.filter((p) => p.date === key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-4 rounded border-b border-ink-on-paper/10 py-2 last:border-b-0"
                  >
                    <span className="w-8 shrink-0 text-center font-display text-sm text-ink-on-paper/60">
                      周{label}
                    </span>
                    <span className="w-10 shrink-0 text-sm tabular-nums text-ink-on-paper/50">
                      {key.slice(8)}
                    </span>
                    <span className="flex-1 text-sm">
                      {dayPlans.length > 0 ? (
                        dayPlans.map((p) => (
                          <span key={p.id} className="mr-3 inline-block text-ink-on-paper">
                            {p.title}
                          </span>
                        ))
                      ) : (
                        <span className="text-ink-on-paper/40">未排期</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
