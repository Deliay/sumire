"use client";

import { useEffect, useRef, useState } from "react";
import { RECORDINGS_CONFIGURED, getRecordingStatus, type RecordingStatusItem } from "@/features/recordings/api";

const POLL_INTERVAL = 30_000;

export type RecordingStatusState =
  | { kind: "loading" }
  | { kind: "ok"; items: RecordingStatusItem[] }
  | { kind: "degraded" };

/**
 * 实时录制状态轮询（F2）：首拉 + 30s 轮询；页面隐藏时暂停，恢复可见立即刷新。
 * 未配置录播服务时不发起任何请求。
 */
export function useRecordingStatus(): RecordingStatusState {
  const [state, setState] = useState<RecordingStatusState>({ kind: "loading" });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!RECORDINGS_CONFIGURED) return;
    let active = true;

    const run = async () => {
      const res = await getRecordingStatus();
      if (!active) return;
      setState(res.ok ? { kind: "ok", items: res.items } : { kind: "degraded" });
    };

    const start = () => {
      if (timerRef.current !== null) return;
      timerRef.current = window.setInterval(() => {
        void run();
      }, POLL_INTERVAL);
    };

    const stop = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        void run();
        start();
      }
    };

    void run();
    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return state;
}
