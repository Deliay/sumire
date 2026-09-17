"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingFile } from "@/features/recordings/api";
import { toIso, windowIndexForOffset, type SegmentBounds } from "./replayWindows";
import { useReplayEvents } from "./useReplayEvents";
import EventTimeline from "./EventTimeline";
import DanmakuOverlay from "./DanmakuOverlay";
import FlvPlayerPanel, { type FlvPlayerPanelController, type FullscreenMode } from "./FlvPlayerPanel";

interface ReplayStageProps {
  roomId: number;
  file: RecordingFile;
  /** 本分段实际覆盖区间（由文件 info 推导）；startMs 为 null 时禁用事件取数。 */
  bounds: SegmentBounds;
}

/** 回放舞台：视频 + canvas 浮层弹幕 + 事件列表，双全屏状态机（web 含列表 / native 仅视频+浮层）。 */
export default function ReplayStage({ roomId, file, bounds }: ReplayStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FlvPlayerPanelController | null>(null);
  const lastWindowRef = useRef(-1);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<FullscreenMode>("none");
  const [nativeAvailable] = useState(
    () => typeof document !== "undefined" && Boolean(document.fullscreenEnabled && Element.prototype.requestFullscreen),
  );

  // 时间锚点取分段实际起点（info.startedAt 推导），非 createdAt；终点优先分段 info 终点，duration 兜底
  const recordStartMs = bounds.startMs;
  const recordEndMs =
    bounds.endMs ?? (recordStartMs !== null && duration > 0 ? recordStartMs + duration * 1000 : null);

  const { events, loading, error, focusWindow, prefetchNext, retry } = useReplayEvents({
    roomId,
    startMs: recordStartMs,
    endMs: recordEndMs,
  });

  const handleTimeUpdate = useCallback((time: number, nextDuration: number) => {
    setCurrentTime(time);
    if (nextDuration > 0) setDuration(nextDuration);
  }, []);

  // 播放进入新窗口时切换关注窗（last-wins 由 hook 代次保证），并预取下一窗
  useEffect(() => {
    if (recordStartMs === null) return;
    const offset = currentTime * 1000;
    const index = windowIndexForOffset(offset);
    if (index !== lastWindowRef.current) {
      lastWindowRef.current = index;
      focusWindow(index);
    }
    prefetchNext(offset);
  }, [recordStartMs, currentTime, focusWindow, prefetchNext]);

  const handleSeek = useCallback(
    (offsetSeconds: number) => {
      controllerRef.current?.seekTo(offsetSeconds);
      lastWindowRef.current = windowIndexForOffset(offsetSeconds * 1000);
      focusWindow(lastWindowRef.current);
      setCurrentTime(offsetSeconds);
    },
    [focusWindow],
  );

  const handleNativeToggle = useCallback(() => {
    if (mode === "native") {
      void document.exitFullscreen?.();
      return;
    }
    if (mode === "web") setMode("none");
    const container = nativeRef.current;
    if (!container || typeof container.requestFullscreen !== "function") return;
    void container
      .requestFullscreen()
      .then(() => setMode("native"))
      .catch(() => {});
  }, [mode]);

  const handleWebToggle = useCallback(() => {
    if (mode === "web") {
      setMode("none");
      return;
    }
    if (mode === "native") void document.exitFullscreen?.();
    setMode("web");
  }, [mode]);

  // fullscreenchange 同步按钮态
  useEffect(() => {
    const onChange = () => {
      const isNative = document.fullscreenElement != null && document.fullscreenElement === nativeRef.current;
      setMode((prev) => (isNative ? "native" : prev === "native" ? "none" : prev));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // 卸载退出 native 全屏
  useEffect(() => {
    const container = nativeRef.current;
    return () => {
      if (document.fullscreenElement != null && document.fullscreenElement === container) {
        void document.exitFullscreen?.();
      }
    };
  }, []);

  // web 全屏：ESC 退出 + body 滚动锁定
  useEffect(() => {
    if (mode !== "web") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("none");
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mode]);

  const stageClass =
    mode === "web"
      ? "fixed inset-0 z-50 flex flex-col gap-4 overflow-hidden bg-night p-4"
      : "flex flex-col gap-4";

  const timelineWrapperClass = "flex min-h-0 flex-col lg:w-1/5";

  return (
    <div ref={stageRef} data-testid="replay-stage" data-fullscreen-mode={mode} className={stageClass}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="lg:w-4/5">
          <FlvPlayerPanel
            roomId={roomId}
            file={file}
            onTimeUpdate={handleTimeUpdate}
            onPlayStateChange={setPlaying}
            controllerRef={controllerRef}
            overlay={
              recordStartMs !== null ? (
                <DanmakuOverlay events={events} recordStart={toIso(recordStartMs)} currentTime={currentTime} playing={playing} />
              ) : null
            }
            fullscreen={{
              mode,
              nativeAvailable,
              onNativeToggle: handleNativeToggle,
              onWebToggle: handleWebToggle,
              containerRef: nativeRef,
            }}
          />
        </div>
        <div className={timelineWrapperClass}>
          <EventTimeline
            events={events}
            loading={loading}
            error={error}
            onRetry={retry}
            currentTime={currentTime}
            recordStartMs={recordStartMs}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
}
