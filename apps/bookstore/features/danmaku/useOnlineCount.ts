"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_CONFIGURED, request } from "@/features/backdoor/api";

/**
 * 直播间在线人数 hook（v1.2）：直接解析 SSE 命名帧 payload.online_count，
 * 5s 节流作用于数值更新（不产生额外请求）；首取 REST 仅作首屏兜底至多 1 次；
 * 不持有 EventSource（由 useLiveEventStream 管理）。
 * 未配置 API 时恒返回 null。
 */
export function useOnlineCount(): {
  onlineCount: number | null;
  onOnlineCount: (envelope: { payload?: { online_count?: number } }) => void;
} {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const lastUpdateRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // ── 首取兜底（至多 1 次 GET）──
  useEffect(() => {
    if (!API_CONFIGURED) return;
    const ac = new AbortController();
    controllerRef.current = ac;
    request<{ items: Array<{ payload?: { online_count?: number } }> }>(
      "/api/live-events?type=online_rank_count&page=1&pageSize=1",
      { signal: ac.signal },
    )
      .then(({ status, data }) => {
        if (status !== 200) return;
        const count = data?.items?.[0]?.payload?.online_count;
        if (typeof count === "number" && Number.isFinite(count)) setOnlineCount(count);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.warn("[useOnlineCount] first fetch failed:", err);
        }
      });
    return () => {
      ac.abort();
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
    };
  }, []);

  // ── 帧取数回调（由 useLiveEventStream 命名帧触发）──
  const onOnlineCount = useCallback(
    (envelope: { payload?: { online_count?: number } }) => {
      const count = envelope?.payload?.online_count;
      if (typeof count !== "number" || !Number.isFinite(count)) return;

      const now = Date.now();
      const elapsed = now - lastUpdateRef.current;

      if (elapsed >= 5000) {
        // leading：立即更新
        lastUpdateRef.current = now;
        if (trailingTimerRef.current != null) {
          clearTimeout(trailingTimerRef.current);
          trailingTimerRef.current = null;
        }
        latestValueRef.current = null;
        setOnlineCount(count);
      } else {
        // trailing：记录最新值，延迟更新
        latestValueRef.current = count;
        if (trailingTimerRef.current == null) {
          trailingTimerRef.current = setTimeout(() => {
            trailingTimerRef.current = null;
            lastUpdateRef.current = Date.now();
            if (latestValueRef.current != null) {
              setOnlineCount(latestValueRef.current);
              latestValueRef.current = null;
            }
          }, 5000 - elapsed);
        }
      }
    },
    [],
  );

  return { onlineCount, onOnlineCount };
}
