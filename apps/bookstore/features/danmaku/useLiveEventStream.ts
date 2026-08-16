"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_CONFIGURED } from "@/features/backdoor/api";
import { LiveEventSchema, type LiveEvent, type LiveEventType } from "./types";

/** SSE 连接状态：idle=未建立（未配置/无类型），connecting=连接中或断线重连中，open=已连接，closed=已关闭。 */
export type LiveStreamStatus = "idle" | "connecting" | "open" | "closed";

export interface LiveEventStream {
  status: LiveStreamStatus;
}

/**
 * 实时事件流（提案 K5）：EventSource 订阅 `/api/live-events/stream`，
 * 事件按 eventId 在内存 Set 去重（历史首屏 + SSE 重叠、重连重推）后分发；
 * 断线由 EventSource 内建自动重连，连接状态经 status 暴露给页面提示条。
 */
export function useLiveEventStream(
  types: LiveEventType[],
  onEvent: (event: LiveEvent) => void,
): LiveEventStream {
  const [status, setStatus] = useState<LiveStreamStatus>("idle");
  const seenRef = useRef<Set<string>>(new Set());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const typesKey = types.join(",");
  const typesRef = useRef(types);
  typesRef.current = types;

  useEffect(() => {
    const currentTypes = typesRef.current;
    if (!API_CONFIGURED || currentTypes.length === 0) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    const params = new URLSearchParams();
    for (const type of currentTypes) params.append("type", type);
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
    return () => {
      es.close();
      setStatus("closed");
    };
    // typesKey 变化（类型组合变更）才重建连接；types 本体经 ref 读取
  }, [typesKey]);

  return { status };
}
