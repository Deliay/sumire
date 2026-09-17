"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LiveEvent } from "@/features/danmaku/types";
import {
  SEEK_REBUILD_SECONDS,
  createDanmakuRenderer,
  danmakuOffsets,
  isSeekJump,
  selectDanmakusToEmit,
  type DanmakuRenderer,
} from "./danmakuOverlay";

interface DanmakuOverlayProps {
  events: LiveEvent[];
  /** 录播起点（ISO 字符串），用于把事件墙上时钟映射到播放时间轴。 */
  recordStart: string;
  currentTime: number;
  playing: boolean;
}

function toInput(event: LiveEvent): { text?: string; emoteUrl?: string; emoteAlt?: string } {
  if (event.emote?.url) return { emoteUrl: event.emote.url, emoteAlt: event.emote.name ?? "弹幕表情" };
  return { text: event.content ?? "" };
}

/** 视频画面上的 canvas 弹幕浮层：绝对定位铺满、不拦截指针事件。 */
export default function DanmakuOverlay({ events, recordStart, currentTime, playing }: DanmakuOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DanmakuRenderer | null>(null);
  const prevTimeRef = useRef(currentTime);

  const offsets = useMemo(() => danmakuOffsets(events, recordStart), [events, recordStart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createDanmakuRenderer(canvas);
    rendererRef.current = renderer;

    const applySize = () => {
      const rect = canvas.getBoundingClientRect();
      renderer.setMetrics(rect.width || canvas.clientWidth, rect.height || canvas.clientHeight, window.devicePixelRatio || 1);
    };
    applySize();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(applySize);
      observer.observe(canvas);
    }
    return () => {
      observer?.disconnect();
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    const prev = prevTimeRef.current;
    prevTimeRef.current = currentTime;
    if (!renderer) return;
    const items = offsets;
    if (isSeekJump(prev, currentTime)) {
      renderer.clear();
      for (const item of selectDanmakusToEmit(items, currentTime - SEEK_REBUILD_SECONDS, currentTime)) {
        renderer.enqueue(toInput(item.event));
      }
      return;
    }
    for (const item of selectDanmakusToEmit(items, prev, currentTime)) {
      renderer.enqueue(toInput(item.event));
    }
  }, [currentTime, offsets]);

  useEffect(() => {
    rendererRef.current?.setPaused(!playing);
  }, [playing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="danmaku-overlay"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
