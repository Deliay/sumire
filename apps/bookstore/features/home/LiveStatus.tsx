"use client";

import { useEffect, useState } from "react";
import { API_CONFIGURED } from "@/features/backdoor/api";
import { getLiveStatus, type LiveStatus } from "@/features/home/api";
import { cn } from "@/lib/cn";

type State =
  | { kind: "loading" }
  | { kind: "live"; status: LiveStatus }
  | { kind: "offline" }
  | { kind: "degraded" };

/**
 * 直播状态：行内紧凑元数据（状态点 + 文案），点击跳直播间。
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

  if (!API_CONFIGURED) return null;

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
      className="inline-flex min-h-11 items-center gap-2 text-small text-ink-dim transition-colors duration-(--duration-fast) hover:text-ink"
      aria-live="polite"
    >
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          state.kind === "live"
            ? "animate-pulse bg-eye"
            : state.kind === "loading"
              ? "bg-line-strong"
              : "bg-ink-mute",
        )}
        aria-hidden
      />
      <span>{label}</span>
    </a>
  );
}
