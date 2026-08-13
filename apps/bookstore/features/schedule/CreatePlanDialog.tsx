"use client";

import { useState, type FormEvent } from "react";
import { createPlan } from "@/features/schedule/api";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";

interface CreatePlanDialogProps {
  open: boolean;
  onClose: () => void;
  /** 创建成功后回调，供父组件本地追加计划（日历即时反映，不整页刷新） */
  onCreated?: (plan: { id: string; date: string; title: string }) => void;
}

/** 增加直播计划 dialog：日期 + 直播主题。 */
export default function CreatePlanDialog({ open, onClose, onCreated }: CreatePlanDialogProps) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { status, data } = await createPlan(date, title.trim());
    setLoading(false);
    if (status === 201 && "ok" in data && data.ok) {
      onCreated?.({ id: data.id, date: data.date, title: data.title });
      setDate("");
      setTitle("");
      onClose();
      return;
    }
    const msg =
      status === 409
        ? "该日已有相同主题的直播计划"
        : "error" in data
          ? data.error ?? "创建失败"
          : "创建失败";
    setError(msg);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-plan-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-vine/50 bg-raised p-7 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="create-plan-title" className="font-serif text-xl font-semibold text-ink">
            增加直播计划
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
          按官方公开的日程录入日期与直播主题
        </p>
        <div className="mt-5 flex flex-col gap-4">
          <TextField
            id="plan-date"
            label="日期"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <TextField
            id="plan-title"
            label="直播主题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            required
          />
          <PrimaryButton type="submit" loading={loading}>
            保存计划
          </PrimaryButton>
          {error && (
            <p className="text-sm text-flower" role="alert">
              {error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
