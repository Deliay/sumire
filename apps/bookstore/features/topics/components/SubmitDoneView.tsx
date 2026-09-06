"use client";

interface SubmitDoneViewProps {
  onAgain: () => void;
}

export default function SubmitDoneView({ onAgain }: SubmitDoneViewProps) {
  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-flower mb-2">提交成功，感谢你的棉花糖</h3>
      <button
        type="button"
        onClick={onAgain}
        className="text-sm text-ink-dim hover:text-ink transition-colors duration-150"
      >
        再投一条
      </button>
    </div>
  );
}
