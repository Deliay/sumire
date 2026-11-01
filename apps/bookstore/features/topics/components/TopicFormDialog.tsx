"use client";

import { useState } from "react";
import MarkdownEditor from "@/features/markdown/MarkdownEditor";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Surface from "@/components/ui/Surface";

interface TopicFormDialogProps {
  mode: "create" | "edit";
  initial?: {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    charLimit: number;
    aiReviewEnabled: boolean;
  };
  onSubmit: (data: {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    charLimit: number;
    aiReviewEnabled: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export default function TopicFormDialog({
  mode,
  initial,
  onSubmit,
  onClose,
}: TopicFormDialogProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [charLimit, setCharLimit] = useState(initial?.charLimit ?? 1000);
  const [aiReviewEnabled, setAiReviewEnabled] = useState(
    initial?.aiReviewEnabled ?? true,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }
    if (title.trim().length > 100) {
      setError("标题不能超过 100 字符");
      return;
    }
    if (!description.trim()) {
      setError("描述不能为空");
      return;
    }
    if (!startAt || !endAt) {
      setError("请选择开始和结束日期");
      return;
    }
    if (new Date(startAt) >= new Date(endAt)) {
      setError("开始日期必须早于结束日期");
      return;
    }
    if (charLimit < 100 || charLimit > 10000) {
      setError("字数限制必须在 100–10000 之间");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        description,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        charLimit,
        aiReviewEnabled,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Surface padding="md" className="w-[28rem] max-w-[calc(100vw-2.5rem)]">
        <h2 className="text-lg font-medium text-ink mb-1">
          {mode === "create" ? "新建主题" : "修改主题"}
        </h2>
        <p className="text-sm text-ink-dim mb-4">填写主题信息</p>

        <div className="space-y-3">
          <Field label="标题" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div>
            <label className="mb-1 block font-mono text-label tracking-label uppercase text-ink-dim">描述</label>
            <MarkdownEditor
              value={description}
              onChange={setDescription}
              minHeight="10rem"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="开始日期" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <Field label="结束日期" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </div>

          <Field
            label="字数限制（100–10000 字）"
            type="number"
            value={charLimit}
            onChange={(e) => setCharLimit(Number(e.target.value))}
            min={100}
            max={10000}
          />

          <div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={aiReviewEnabled}
                onChange={(e) => setAiReviewEnabled(e.target.checked)}
                className="rounded border-line"
              />
              启用AI前置审核
            </label>
            <p className="text-xs text-ink-dim mt-1">
              勾选后投递内容将经 AI 自动审核
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-3 text-sm text-crimson">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中…" : mode === "create" ? "创建" : "保存"}
          </Button>
        </div>
      </Surface>
    </div>
  );
}
