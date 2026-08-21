"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_CONFIGURED, request } from "@/features/backdoor/api";

/**
 * 直播间在线人数 hook：首取 REST + SSE 事件驱动 + 5s 节流（leading + trailing）。
 * 未配置 API 时恒返回 null。
 */
export function useOnlineCount(): number | null {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const lastFlushRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 首取 ──
  useEffect(() => {
    if (!API_CONFIGURED) return;
    const ac = new AbortController();
    request<{ items: Array<{ payload: { online_count: number } }> }>(
      "/api/live-events?type=online_rank_count&page=1&pageSize=1",
      { signal: ac.signal },
    ).then(({ data }) => {
      const count = data?.items?.[0]?.payload?.online_count;
      if (typeof count === "number") setOnlineCount(count);
    });
    return () => ac.abort();
  }, []);

  // ── SSE 事件驱动 ──
  useEffect(() => {
    if (!API_CONFIGURED) return;

    const flush = (count: number) => {
      const now = Date.now();
      const elapsed = now - lastFlushRef.current;
      if (elapsed >= 5000) {
        lastFlushRef.current = now;
        setOnlineCount(count);
        if (trailingTimerRef.current != null) {
          clearTimeout(trailingTimerRef.current);
          trailingTimerRef.current = null;
        }
      } else if (trailingTimerRef.current == null) {
        trailingTimerRef.current = setTimeout(() => {
          trailingTimerRef.current = null;
          lastFlushRef.current = Date.now();
          setOnlineCount(count);
        }, 5000 - elapsed);
      }
    };

    const es = new EventSource(`${API_BASE_URL}/api/live-events/stream?type=online_rank_count`, {
      withCredentials: true,
    });

    es.addEventListener("online_rank_count", ((e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { online_count?: number };
        if (typeof parsed.online_count === "number") flush(parsed.online_count);
      } catch {
        // 非法帧静默忽略
      }
    }) as EventListener);

    return () => {
      es.close();
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
    };
  }, []);

  return onlineCount;
}
