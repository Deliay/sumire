"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/features/backdoor/session";
import { atLeast } from "@/features/backdoor/roleAccess";
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
      return;
    }
    setConfirming(type);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirming(null), CONFIRM_TIMEOUT_MS);
  }

  const readAllTypes: ReadAllType[] = canManage ? ["guard_buy", "super_chat"] : [];

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
