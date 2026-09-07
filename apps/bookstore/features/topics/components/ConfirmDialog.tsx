"use client";

interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-lg border border-vine bg-raised p-6 text-center">
        <p className="text-sm text-ink mb-4">
          内容会被AI审核，如果有有害信息，则会判定为未通过AI审核，默认隐藏
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-ink-dim hover:text-ink"
          >
            再想想
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 text-sm bg-primary text-night rounded hover:bg-primary/90"
          >
            确认投递
          </button>
        </div>
      </div>
    </div>
  );
}
