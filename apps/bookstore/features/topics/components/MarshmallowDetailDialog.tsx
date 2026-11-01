"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import MarkdownView from "@/features/markdown/MarkdownView";
import type { Marshmallow } from "@/features/topics/types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";

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
      <Surface
        padding="md"
        className="flex w-[40rem] max-w-[calc(100vw-2.5rem)] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-lg font-medium text-ink">棉花糖全文</h2>
          {onToggleAdopt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleAdopt(marshmallow.id, !marshmallow.adopted)}
            >
              {marshmallow.adopted ? "取消采用" : "采用"}
            </Button>
          )}
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          <MarkdownView content={marshmallow.content} />
        </div>
        <div className="mt-4 flex shrink-0 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
      </Surface>
    </div>,
    document.body,
  );
}