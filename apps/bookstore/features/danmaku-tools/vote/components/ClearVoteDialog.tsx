"use client";

import { useEffect, useCallback, useRef } from "react";

interface ClearVoteDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ClearVoteDialog({
  open,
  onConfirm,
  onCancel,
}: ClearVoteDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    // 打开后焦点落于取消按钮
    cancelButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-vote-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-vine/50 bg-raised p-6 shadow-2xl">
        <h2
          id="clear-vote-dialog-title"
          className="font-serif text-lg font-semibold text-ink"
        >
          确认清空
        </h2>
        <p className="mt-2 text-sm text-ink-dim">
          将清空当前所有投票数据（选项、统计与已投票记录），是否确认？
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-md border border-vine/50 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-raised"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-crimson px-4 py-2 text-sm font-medium text-ink-on-paper transition-colors hover:bg-crimson/80"
          >
            确认清空
          </button>
        </div>
      </div>
    </div>
  );
}
