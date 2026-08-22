"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";
import { LiveEventSchema, type LiveEvent } from "./types";

/** SSE 连接状态：idle=未建立（未配置/无类型），connecting=连接中或断线重连中，open=已连接，closed=已关闭。 */
export type LiveStreamStatus = "idle" | "connecting" | "open" | "closed";

/**
 * 实时事件流（提案 K5）：EventSource 订阅 `/api/live-events/stream`，
 * 事件按 eventId 在内存 Set 去重（历史首屏 + SSE 重叠、重连重推）后分发；
 * 断线由 EventSource 内建自动重连，连接状态经 status 暴露给页面提示条。
 * v1.2：新增 `onOnlineCount` 回调，`online_rank_count` 命名帧直接解析透出（帧即完整信封），
 * 全页面仅一条 SSE 连接。
 */
export function useLiveEventStream(
  types: readonly string[],
  onEvent: (event: LiveEvent) => void,
  onOnlineCount?: (envelope: { payload?: { online_count?: number } }) => void,
): LiveStreamStatus {
  const enabled = API_CONFIGURED && types.length > 0;
  const typesKey = types.join(",");
  const [status, setStatus] = useState<LiveStreamStatus>(enabled ? "connecting" : "idle");
  const seenRef = useRef<Set<string>>(new Set());
  const onEventRef = useRef(onEvent);
  const onOnlineCountRef = useRef(onOnlineCount);

  // 类型组合变更时在渲染期重置状态（React 推荐的 derive-state 模式），由 effect 重建连接
  const [prevTypesKey, setPrevTypesKey] = useState(typesKey);
  if (prevTypesKey !== typesKey) {
    setPrevTypesKey(typesKey);
    setStatus(enabled ? "connecting" : "idle");
  }

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    onOnlineCountRef.current = onOnlineCount;
  });

  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams();
    for (const type of typesKey.split(",")) params.append("type", type);
    const es = new EventSource(`${API_BASE_URL}/api/live-events/stream?${params.toString()}`, {
      withCredentials: true,
    });
    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? "closed" : "connecting");
    es.onmessage = (msg) => {
      try {
        const parsed = LiveEventSchema.safeParse(JSON.parse(msg.data));
        if (!parsed.success) return;
        const event = parsed.data;
        if (seenRef.current.has(event.eventId)) return;
        seenRef.current.add(event.eventId);
        onEventRef.current(event);
      } catch {
        // 非法帧静默忽略，不中断流
      }
    };
    // 命名帧：online_rank_count 透传上游原始信封，不经 LiveEvent 归一化
    es.addEventListener("online_rank_count", ((msg: MessageEvent) => {
      try {
        const data = JSON.parse(msg.data) as { payload?: { online_count?: number } };
        onOnlineCountRef.current?.(data);
      } catch {
        // 非法帧静默忽略
      }
    }) as EventListener);
    return () => es.close();
    // typesKey 变化（类型组合变更）才重建连接
  }, [typesKey, enabled]);

  return status;
}
