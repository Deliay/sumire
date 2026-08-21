"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_CONFIGURED, request } from "@/features/backdoor/api";

/**
 * 直播间在线人数 hook：首取 REST + SSE 事件驱动 + 5s 节流（leading + trailing）。
 * 未配置 API 时恒返回 null。
 */
export function useOnlineCount(): number | null {
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const lastFetchRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // ── 取数函数 ──
  const fetchOnlineCount = () => {
    const now = Date.now();
    const elapsed = now - lastFetchRef.current;
    
    if (elapsed >= 5000) {
      // leading：立即执行
      lastFetchRef.current = now;
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      // 取消进行中的请求
      controllerRef.current?.abort();
      const ac = new AbortController();
      controllerRef.current = ac;
      request<{ items: Array<{ payload?: { online_count?: number } }> }>(
        "/api/live-events?type=online_rank_count&page=1&pageSize=1",
        { signal: ac.signal },
      )
        .then(({ data }) => {
          const count = data?.items?.[0]?.payload?.online_count;
          if (typeof count === "number") setOnlineCount(count);
        })
        .catch((err) => {
          // 忽略 AbortError（组件卸载或竞态取消）
          if (err?.name !== "AbortError") {
            console.warn("[useOnlineCount] fetch failed:", err);
          }
        });
    } else if (trailingTimerRef.current == null) {
      // trailing：延迟执行
      trailingTimerRef.current = setTimeout(() => {
        trailingTimerRef.current = null;
        lastFetchRef.current = Date.now();
        // 取消进行中的请求
        controllerRef.current?.abort();
        const ac = new AbortController();
        controllerRef.current = ac;
        request<{ items: Array<{ payload?: { online_count?: number } }> }>(
          "/api/live-events?type=online_rank_count&page=1&pageSize=1",
          { signal: ac.signal },
        )
          .then(({ data }) => {
            const count = data?.items?.[0]?.payload?.online_count;
            if (typeof count === "number") setOnlineCount(count);
          })
          .catch((err) => {
            // 忽略 AbortError（组件卸载或竞态取消）
            if (err?.name !== "AbortError") {
              console.warn("[useOnlineCount] fetch failed:", err);
            }
          });
      }, 5000 - elapsed);
    }
  };

  // ── 首取 ──
  useEffect(() => {
    if (!API_CONFIGURED) return;
    fetchOnlineCount();
    return () => {
      controllerRef.current?.abort();
      // 复位 lastFetchRef，确保 StrictMode 二次挂载重新走 leading 分支
      lastFetchRef.current = 0;
      if (trailingTimerRef.current != null) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
    };
  }, []);

  // ── SSE 事件驱动 ──
  useEffect(() => {
    if (!API_CONFIGURED) return;

    const es = new EventSource(`${API_BASE_URL}/api/live-events/stream?type=online_rank_count`, {
      withCredentials: true,
    });

    es.addEventListener("online_rank_count", (() => {
      // SSE 帧仅作为触发器，不解析 payload；数值仍经 GET 取数（与 PRD 口径一致）
      // 触发 leading+trailing 节流重新 GET
      fetchOnlineCount();
    }) as EventListener);

    return () => {
      es.close();
    };
  }, []);

  return onlineCount;
}
