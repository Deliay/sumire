"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { getLiveStatus, type LiveStatus } from "@/features/home/api";

type State =
  | { kind: "loading" }
  | { kind: "live"; status: LiveStatus }
  | { kind: "offline" }
  | { kind: "degraded" };

/**
 * 直播状态组件：展示「直播中 / 未开播」状态，点击跳转直播间（新窗口）。
 * 仅在 API_CONFIGURED 时挂载；未配置返回 null 不留占位。
 */
export default function LiveStatus({ liveUrl }: { liveUrl: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!API_CONFIGURED) return;
    let active = true;
    void (async () => {
      try {
        const res = await getLiveStatus();
        if (!active) return;
        if (res.ok && res.status) {
          setState(res.status.live ? { kind: "live", status: res.status } : { kind: "offline" });
        } else {
          setState({ kind: "degraded" });
        }
      } catch {
        if (active) setState({ kind: "degraded" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!API_CONFIGURED) {
    return null;
  }

  const label =
    state.kind === "loading"
      ? "直播状态加载中"
      : state.kind === "live"
        ? "直播中"
        : state.kind === "offline"
          ? "未开播"
          : "直播状态";

  return (
    <a
      href={liveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit items-center gap-2.5 rounded-full border border-vine px-4 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
      aria-live="polite"
    >
      <span
        className={`inline-block size-3 rounded-full ${
          state.kind === "live"
            ? "bg-eye animate-pulse"
            : state.kind === "loading"
              ? "bg-vine"
              : "bg-ink-dim/40"
        }`}
        aria-hidden
      />
      <span className="font-display tracking-widest">{label}</span>
      <Radio size={14} aria-hidden />
    </a>
  );
}