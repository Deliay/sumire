"use client";

import { useRef, useState } from "react";
import { parseTimeStr } from "@/features/schedule/dateUtils";
import { useDismiss } from "@/features/schedule/useDismiss";

const QUICK_TIMES = ["08:00", "13:00", "16:00", "20:00", "22:00"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  /** 是否合法（父级用于提示），仅影响样式与回显。 */
  invalid?: boolean;
}

/** 定制时间选择器：只读输入框 + 时/分双列滚轮浮层 + 快捷时段，支持键入 HH:mm。 */
export default function TimePicker({ id, value, onChange, invalid }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState("");
  const [hint, setHint] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useDismiss(wrapRef, open, () => setOpen(false));

  const [h, m] = (() => {
    const p = parseTimeStr(value);
    if (!p) return ["", ""];
    const [hh, mm] = p.split(":");
    return [hh, mm];
  })();

  function commitTime(time: string) {
    onChange(time);
    setOpen(false);
    setHint("");
  }

  function handleBlur() {
    if (!editing) return;
    const p = parseTimeStr(editing);
    if (p) {
      onChange(p);
      setHint("");
    } else {
      setHint("时间格式应为 HH:mm");
    }
    setEditing("");
  }

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-dim">
        开始时间
      </label>
      <input
        id={id}
        readOnly={!open}
        value={editing !== "" ? editing : value}
        onFocus={() => {
          setEditing(value);
          setOpen(true);
        }}
        onBlur={(e) => {
          handleBlur();
          if (wrapRef.current && !wrapRef.current.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        onChange={(e) => setEditing(e.target.value)}
        className={`w-full rounded-md border bg-soft px-3 py-2 text-base tabular-nums text-ink outline-none transition-colors duration-150 focus:border-flower ${
          invalid ? "border-flower" : "border-vine/50"
        }`}
        placeholder="20:00"
        aria-label="开始时间"
        autoComplete="off"
      />
      {hint && <p className="text-xs text-flower">{hint}</p>}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-vine/50 bg-raised p-3 shadow-xl">
          <div className="flex gap-2">
            <div className="max-h-48 flex-1 overflow-y-auto">
              {HOURS.map((hh) => (
                <button
                  key={hh}
                  type="button"
                  onClick={() => commitTime(`${hh}:${m || "00"}`)}
                  className={`block w-full rounded px-2 py-1 text-right text-sm tabular-nums transition-colors ${
                    hh === h ? "bg-soft font-semibold text-flower" : "text-ink hover:bg-soft"
                  }`}
                >
                  {hh}
                </button>
              ))}
            </div>
            <div className="max-h-48 flex-1 overflow-y-auto">
              {MINUTES.map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => commitTime(`${h || "00"}:${mm}`)}
                  className={`block w-full rounded px-2 py-1 text-left text-sm tabular-nums transition-colors ${
                    mm === m ? "bg-soft font-semibold text-flower" : "text-ink hover:bg-soft"
                  }`}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-vine/40 pt-2">
            {QUICK_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => commitTime(t)}
                className="rounded border border-vine/50 px-2 py-0.5 text-xs tabular-nums text-ink-dim transition-colors hover:border-flower hover:text-ink"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
