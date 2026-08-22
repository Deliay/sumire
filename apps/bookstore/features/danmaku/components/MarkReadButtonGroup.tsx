"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { ReadAllType } from "../api";

const READ_ALL_LABELS: Record<ReadAllType, string> = {
  super_chat: "SC 全部已读",
  guard_buy: "上船 全部已读",
};

/** 「标记全部已读」二次确认超时（ms），超时未确认自动复位。 */
const CONFIRM_TIMEOUT_MS = 3000;

interface MarkReadButtonGroupProps {
  hideLowSc: boolean;
  onToggleHideLowSc: () => void;
  onReadAll: (type: ReadAllType) => void;
}

export default function MarkReadButtonGroup({
  hideLowSc,
  onToggleHideLowSc,
  onReadAll,
}: MarkReadButtonGroupProps) {
  const { session } = useSession();
  const canManage = session.status === "authenticated" && atLeast(session.me.role, "admin");

  const [confirming, setConfirming] = useState<ReadAllType | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 空间不足折叠：窄视口(<640) 恒折叠
  const shouldCollapse = useMediaQuery("(max-width: 639px)");

  // 点击外部关闭 dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  function handleReadAllClick(type: ReadAllType) {
    if (confirming === type) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirming(null);
      onReadAll(type);
      setDropdownOpen(false);
      return;
    }
    setConfirming(type);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
  }

  const readAllTypes: ReadAllType[] = canManage ? ["guard_buy", "super_chat"] : [];

  // 折叠态：单个触发钮 + dropdown 菜单
  if (shouldCollapse) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-expanded={dropdownOpen}
          aria-label="标记已读"
          className="rounded-md border border-vine/50 px-2 py-1 text-xs text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
        >
          标记已读
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 z-[80] mt-1 min-w-[10rem] rounded-md border border-vine/50 bg-raised shadow-xl">
            {readAllTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleReadAllClick(type)}
                className={`block w-full px-3 py-2 text-left text-xs transition-colors duration-150 ${
                  confirming === type
                    ? "text-flower"
                    : "text-ink-dim hover:bg-soft hover:text-ink"
                }`}
              >
                {confirming === type ? "确认全部已读？" : READ_ALL_LABELS[type]}
              </button>
            ))}
            <button
              type="button"
              role="switch"
              aria-checked={hideLowSc}
              onClick={() => { onToggleHideLowSc(); setDropdownOpen(false); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-ink-dim transition-colors duration-150 hover:bg-soft hover:text-ink"
            >
              隐藏钢镚
              <span className={`inline-block h-4 w-7 rounded-full transition-colors duration-150 ${hideLowSc ? "bg-flower" : "bg-vine/50"}`}>
                <span className={`block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${hideLowSc ? "translate-x-3" : "translate-x-0.5"}`} />
              </span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 平铺态
  return (
    <div className="flex items-center gap-2">
      {readAllTypes.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => handleReadAllClick(type)}
          className={`rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
            confirming === type
              ? "border-flower text-flower"
              : "border-vine/50 text-ink-dim hover:border-flower hover:text-ink"
          }`}
        >
          {confirming === type ? "确认全部已读？" : READ_ALL_LABELS[type]}
        </button>
      ))}
      <button
        type="button"
        role="switch"
        aria-checked={hideLowSc}
        aria-label="隐藏钢镚"
        onClick={onToggleHideLowSc}
        className={`rounded-md border px-2 py-1 text-xs transition-colors duration-150 ${
          hideLowSc
            ? "border-flower text-ink"
            : "border-vine/50 text-ink-dim hover:border-flower hover:text-ink"
        }`}
      >
        隐藏钢镚
      </button>
    </div>
  );
}
