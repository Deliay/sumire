"use client";

import { useState, type FormEvent } from "react";
import { createPlan, updatePlan, type StreamPlan } from "@/features/schedule/api";
import DatePicker from "@/features/schedule/DatePicker";
import TimePicker from "@/features/schedule/TimePicker";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";
import { parseDateStr, parseTimeStr } from "@/features/schedule/dateUtils";

interface PlanFormDialogProps {
  open: boolean;
  /** 录入态 create / 编辑态 edit */
  mode: "create" | "edit";
  /** 编辑态初始计划 */
  initial?: StreamPlan | null;
  /** 录入态预填日期（从当日弹层「增加计划」进入时） */
  preselectDate?: string;
  onClose: () => void;
  /** 保存成功后回调（create 传新计划、edit 传更新后计划） */
  onSaved: (plan: StreamPlan) => void;
}

/** 录入 / 编辑直播计划表单弹层：日期 + 开始时间 + 主题，使用定制选择器。
 *  父组件通过变更 key 使其在每次打开时以 props 重新初始化。 */
export default function PlanFormDialog({
  open,
  mode,
  initial,
  preselectDate,
  onClose,
  onSaved,
}: PlanFormDialogProps) {
  const [date, setDate] = useState(() => (mode === "edit" && initial ? initial.date : (preselectDate ?? "")));
  const [startTime, setStartTime] = useState(() => (mode === "edit" && initial ? initial.startTime : ""));
  const [title, setTitle] = useState(() => (mode === "edit" && initial ? initial.title : ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const dateInvalid = date !== "" && !parseDateStr(date);
  const timeInvalid = startTime !== "" && !parseTimeStr(startTime);
  const emptyField = !date || !startTime || !title.trim();
  const canSubmit = !emptyField && !dateInvalid && !timeInvalid;

  function validate(): string | null {
    if (!date) return "请选择日期";
    if (dateInvalid) return "日期格式应为 YYYY-MM-DD";
    if (!startTime) return "请选择开始时间";
    if (timeInvalid) return "开始时间格式应为 HH:mm";
    if (!title.trim()) return "直播主题不能为空";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    const v = validate();
    if (v) {
      setTouched(true);
      setError(v);
      return;
    }
    setLoading(true);
    setError("");
    const input = { date, startTime: parseTimeStr(startTime)!, title: title.trim() };
    const { status, data } =
      mode === "edit" && initial
        ? await updatePlan(initial.id, input)
        : await createPlan(input.date, input.startTime, input.title);
    setLoading(false);
    if (status === 200 || status === 201) {
      if ("ok" in data) {
        onSaved({
          id: data.id,
          date: data.date,
          startTime: data.startTime,
          title: data.title,
          createdAt: initial?.createdAt ?? new Date().toISOString(),
        });
      }
      onClose();
      return;
    }
    const msg =
      status === 409
        ? "该日该时间已有相同主题的直播计划"
        : "error" in data
          ? data.error ?? "保存失败"
          : "保存失败";
    setError(msg);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-vine/50 bg-raised p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="plan-form-title" className="font-serif text-xl font-semibold text-ink">
            {mode === "edit" ? "编辑直播计划" : "增加直播计划"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-dim transition-colors hover:text-ink"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          按官方公开的日程录入日期、开始时间与主题
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <DatePicker id="plan-date" value={date} onChange={setDate} invalid={touched && dateInvalid} />
          <TimePicker id="plan-time" value={startTime} onChange={setStartTime} invalid={touched && timeInvalid} />
          <TextField
            id="plan-title"
            label="直播主题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            placeholder="歌杂 / 早台读书…"
          />
          <PrimaryButton type="submit" loading={loading} disabled={!canSubmit}>
            确认
          </PrimaryButton>
          <button
            type="button"
            onClick={onClose}
            className="text-center text-sm text-ink-dim transition-colors hover:text-ink"
          >
            取消
          </button>
          {(error || (touched && emptyField)) && (
            <p className="text-sm text-flower" role="alert">
              {error || "请填写日期、开始时间与直播主题"}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
