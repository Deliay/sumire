import type { Metadata } from "next";
import { Suspense } from "react";
import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import ReplayApp from "@/features/recordings/replay/ReplayApp";

export const metadata: Metadata = {
  title: "录播回放 · 枝堇",
  description: "枝堇Sumire 录播回放：视频与弹幕事件同步回看。",
};

// 录播页为 SSG 静态导出，查询参数（roomId/file）由客户端解析，故用 Suspense 包 useSearchParams。
export default function RecordingsReplayPage() {
  if (!RECORDINGS_CONFIGURED) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2.5 py-24 lg:px-5">
        <p className="text-ink-dim">录播服务未配置，暂时无法回放。</p>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <ReplayApp />
    </Suspense>
  );
}
