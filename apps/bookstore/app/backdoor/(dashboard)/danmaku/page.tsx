"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DanmakuDashboard from "@/features/danmaku/components/DanmakuDashboard";

/**
 * 弹幕后台页：复用 (dashboard)/layout.tsx 会话守卫，数据全部客户端拉取。
 * 「全屏模式」按钮位于页头同一行结尾，点击后分栏区（含实时连接提示）占满整个屏幕，
 * 通过 Fullscreen API 切换，并监听 fullscreenchange 同步按钮态。
 */
export default function DanmakuPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const target = containerRef.current;
    if (!target) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void target.requestFullscreen();
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">弹幕后台</h1>
          <p className="mt-1 text-ink-dim">直播间弹幕、醒目留言、礼物与上船一览</p>
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? "退出全屏" : "全屏模式"}
          className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
        >
          {isFullscreen ? "退出全屏" : "全屏模式"}
        </button>
      </div>
      <div
        ref={containerRef}
        className={isFullscreen ? "flex flex-1 flex-col overflow-hidden" : ""}
      >
        <DanmakuDashboard isFullscreen={isFullscreen} />
      </div>
    </div>
  );
}
