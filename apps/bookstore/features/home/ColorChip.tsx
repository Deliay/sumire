"use client";

import { useState } from "react";

/**
 * 应援色 chips：点击复制色值。
 */
export default function ColorChip({ color }: { color: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex w-fit items-center gap-2.5 rounded-full border border-vine px-4 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
      aria-live="polite"
    >
      <span
        className="inline-block size-3.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-display tracking-widest">{color}</span>
      <span className="text-xs">{copied ? "已复制" : "点击复制"}</span>
    </button>
  );
}
