"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clampMinPrice } from "../giftMinPrice";

/**
 * 礼物最低金额筛选控件：按钮 + 弹层（滑动条 0–100 步进 0.1 + 输入框双向同步）。
 * 内部草稿字符串允许输入中间态（如 `1.`），提交时 clampMinPrice 夹取。
 * 防抖 300ms 提交，输入框 blur/Enter 立即提交。
 */

interface GiftFilterControlProps {
  /** 当前生效的阈值（外部状态）。 */
  value: number;
  /** 阈值提交回调（已夹取）。 */
  onChange: (value: number) => void;
}

export default function GiftFilterControl({ value, onChange }: GiftFilterControlProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 点击外部关闭（按钮 + portal 弹层均不算外部）
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const commit = useCallback(
    (raw: string) => {
      clearTimeout(debounceRef.current);
      const clamped = clampMinPrice(raw);
      setDraft(String(clamped));
      onChange(clamped);
    },
    [onChange],
  );

  const handleDraftChange = useCallback(
    (raw: string) => {
      setDraft(raw);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit(raw);
      }, 300);
    },
    [commit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit(draft);
      }
    },
    [draft, commit],
  );

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setPopPos({ x: rect.left, y: rect.bottom + 4 });
      }
      return !prev;
    });
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label="礼物筛选"
        className={`rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
          value > 0
            ? "border-flower text-ink"
            : "border-vine/50 text-ink-dim hover:border-flower hover:text-ink"
        }`}
      >
        礼物筛选
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 w-56 rounded-md border border-vine/50 bg-raised p-3 shadow-lg"
            style={{ left: popPos.x, top: popPos.y }}
          >
            <label htmlFor="gift-min-price" className="mb-2 block text-xs text-ink-dim">
              最低礼物价值（元）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={Number.isFinite(Number(draft)) ? Number(draft) : 0}
                onChange={(e) => handleDraftChange(e.target.value)}
                className="accent-primary flex-1"
              />
              <input
                id="gift-min-price"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onBlur={() => commit(draft)}
                onKeyDown={handleKeyDown}
                className="w-16 rounded border border-vine/50 bg-soft px-1 py-0.5 text-right text-sm text-ink"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
