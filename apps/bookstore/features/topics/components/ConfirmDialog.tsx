"use client";

import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";

interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Surface padding="md" className="w-80 text-center">
        <p className="mb-4 text-small text-ink">
          内容会被AI审核，如果有有害信息，则会判定为未通过AI审核，默认隐藏
        </p>
        <div className="flex justify-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            再想想
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            确认投递
          </Button>
        </div>
      </Surface>
    </div>
  );
}
