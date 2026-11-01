"use client";

import { useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";

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
      <Surface padding="md" className="relative w-full max-w-md">
        <h2
          id="clear-vote-dialog-title"
          className="font-serif text-h3 font-semibold text-ink"
        >
          确认清空
        </h2>
        <p className="mt-2 text-small text-ink-dim">
          将清空当前所有投票数据（选项、统计与已投票记录），是否确认？
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} autoFocus>
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            确认清空
          </Button>
        </div>
      </Surface>
    </div>
  );
}
