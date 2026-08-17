"use client";

import { useState } from "react";
import DanmakuDashboard from "@/features/danmaku/components/DanmakuDashboard";
import ColumnCountSelector from "@/features/danmaku/components/ColumnCountSelector";

/**
   * 弹幕看板页：复用 (dashboard)/layout.tsx 会话守卫，数据全部客户端拉取。
 * 「视图栏」选择器与「全屏模式」按钮同排位于页头结尾，点击后分栏区（含实时连接提示）
 * 以 fixed 遮罩占满整个网页窗口（覆盖顶栏/侧栏），再次点击退出。
 */
export default function DanmakuPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      {!isFullscreen && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-ink">弹幕看板</h1>
              <p className="mt-1 text-ink-dim">直播间弹幕、醒目留言、礼物与上船一览</p>
            </div>
            <div className="flex items-center gap-3">
              <ColumnCountSelector />
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                aria-pressed={isFullscreen}
                aria-label="全屏模式"
                className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
              >
                全屏模式
              </button>
            </div>
          </div>
          <DanmakuDashboard isFullscreen={false} />
        </div>
      )}
      {isFullscreen && (
        <div
          data-testid="danmaku-fullscreen"
          className="fixed inset-0 z-[60] flex h-svh flex-col overflow-hidden bg-bg"
        >
          <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-vine/50 bg-raised px-3 py-2">
            <h1 className="font-serif text-xl font-semibold text-ink">弹幕看板</h1>
            <div className="flex items-center gap-3">
              <ColumnCountSelector />
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                aria-pressed={true}
                aria-label="退出全屏"
                className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
              >
                退出全屏
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <DanmakuDashboard isFullscreen />
          </div>
        </div>
      )}
    </>
  );
}
