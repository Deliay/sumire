"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import MarkdownView from "@/features/markdown/MarkdownView";
import type { Marshmallow } from "@/features/topics/types";

interface MarshmallowDetailDialogProps {
  marshmallow: Marshmallow;
  onToggleAdopt?: (id: string, adopted: boolean) => void;
  onClose: () => void;
}

export default function MarshmallowDetailDialog({
  marshmallow,
  onToggleAdopt,
  onClose,
}: MarshmallowDetailDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-[40rem] max-w-[calc(100vw-2.5rem)] rounded-lg border border-vine bg-raised p-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-lg font-medium text-ink">棉花糖全文</h2>
          {onToggleAdopt && (
            <button
              type="button"
              onClick={() => onToggleAdopt(marshmallow.id, !marshmallow.adopted)}
              className="text-xs text-ink-dim hover:text-ink border border-vine rounded px-2 py-1"
            >
              {marshmallow.adopted ? "取消采用" : "采用"}
            </button>
          )}
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          <MarkdownView content={marshmallow.content} />
        </div>
        <div className="mt-4 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-ink-dim hover:text-ink"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}