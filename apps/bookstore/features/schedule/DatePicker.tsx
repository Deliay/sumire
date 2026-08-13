"use client";

import { useMemo, useRef, useState } from "react";
import { WEEKDAYS, monthGrid, parseDateStr, shiftMonth, toDateStr } from "@/features/schedule/dateUtils";
import { useDismiss } from "@/features/schedule/useDismiss";

/** 将 YYYY-MM-DD 显示为「2026 年 8 月 15 日」；空值返回 ""。 */
export function formatDateLabel(value: string): string {
  const p = parseDateStr(value);
  if (!p) return "";
  return `${p.y} 年 ${p.m} 月 ${p.d} 日`;
}

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  /** 是否合法（父级用于提示），仅影响样式与回显，不阻断选择。 */
  invalid?: boolean;
}

/** 定制日期选择器：只读输入框 + 迷你月历浮层，支持键入 YYYY-MM-DD。 */
export default function DatePicker({ id, value, onChange, invalid }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState("");
  const [hint, setHint] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseDateStr(value), [value]);
  const [view, setView] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1 };
  });

  useDismiss(wrapRef, open, () => setOpen(false));

  function openPicker() {
    if (parsed) setView({ y: parsed.y, m: parsed.m });
    setOpen(true);
  }

  function commitDate(dateStr: string) {
    onChange(dateStr);
    setOpen(false);
    setHint("");
  }

  function goMonth(delta: number) {
    setView((v) => shiftMonth(v.y, v.m, delta));
  }

  function handleBlur() {
    if (!editing) return;
    const p = parseDateStr(editing);
    if (p) {
      onChange(toDateStr(p.y, p.m, p.d));
      setHint("");
    } else {
      setHint("日期格式应为 YYYY-MM-DD");
    }
    setEditing("");
  }

  const cells = monthGrid(view.y, view.m);

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-dim">
        日期
      </label>
      <input
        id={id}
        readOnly={!open}
        value={editing !== "" ? editing : formatDateLabel(value)}
        onFocus={() => {
          setEditing(value);
          openPicker();
        }}
        onBlur={handleBlur}
        onChange={(e) => setEditing(e.target.value)}
        className={`w-full rounded-md border bg-soft px-3 py-2 text-base text-ink outline-none transition-colors duration-150 focus:border-flower ${
          invalid ? "border-flower" : "border-vine/50"
        }`}
        placeholder="2026-08-15"
        aria-label="日期"
      />
      {hint && <p className="text-xs text-flower">{hint}</p>}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-vine/50 bg-raised p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="rounded border border-vine/50 px-2 py-1 text-sm text-ink-dim hover:text-ink"
              aria-label="上一月"
            >
              ←
            </button>
            <span className="font-serif text-sm font-semibold text-ink">
              {view.y} 年 {view.m} 月
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="rounded border border-vine/50 px-2 py-1 text-sm text-ink-dim hover:text-ink"
              aria-label="下一月"
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 text-center font-display text-[10px] tracking-widest text-ink-dim">
                周{w}
              </div>
            ))}
            {cells.map((cell) => {
              const isSelected = cell.dateStr === value;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => commitDate(cell.dateStr)}
                  className={`rounded py-1 text-center text-xs transition-colors ${
                    !cell.inMonth
                      ? "text-ink-dim/40"
                      : isSelected
                        ? "border border-flower bg-soft font-semibold text-ink"
                        : "text-ink hover:bg-soft"
                  }`}
                  aria-label={`选择 ${cell.dateStr}`}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
