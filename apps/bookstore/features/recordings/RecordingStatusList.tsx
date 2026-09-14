"use client";

import { liveAudioUrl } from "@/features/recordings/api";
import LiveAudioButton from "@/features/recordings/LiveAudioButton";
import type { RecordingStatusState } from "@/features/recordings/useRecordingStatus";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 实时录制状态列表（F2）+ 听直播（F3）：展示层，数据由 useRecordingStatus 提供。 */
export default function RecordingStatusList({ state }: { state: RecordingStatusState }) {
  return (
    <section aria-labelledby="recording-status-heading" className="flex flex-col gap-4">
      <h2 id="recording-status-heading" className="font-serif text-h2 text-ink">
        实时录制状态
      </h2>

      {state.kind === "loading" && <p className="text-ink-dim">正在获取录制状态…</p>}

      {state.kind === "degraded" && (
        <p className="rounded-2xl border border-vine/50 bg-raised/60 px-5 py-6 text-ink-dim">
          录播服务暂时不可用，请稍后再试。
        </p>
      )}

      {state.kind === "ok" && state.items.length === 0 && (
        <p className="rounded-2xl border border-vine/50 bg-raised/60 px-5 py-6 text-ink-dim">
          暂无录制中的直播间。
        </p>
      )}

      {state.kind === "ok" && state.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.items.map((item) => {
            const recording = item.state === "recording";
            return (
              <li
                key={item.roomId}
                className="flex flex-col gap-2 rounded-2xl border border-vine/50 bg-raised/60 px-5 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-serif text-ink">{item.streamerName || `直播间 ${item.roomId}`}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-tiny ${
                      recording ? "border-eye/60 text-eye" : "border-vine/60 text-ink-dim"
                    }`}
                  >
                    <span
                      className={`inline-block size-2 rounded-full ${recording ? "bg-eye animate-pulse" : "bg-ink-dim/40"}`}
                      aria-hidden
                    />
                    {recording ? "录制中" : "未在直播"}
                  </span>
                </div>

                {item.sessionTitle && <p className="text-small text-ink-dim">{item.sessionTitle}</p>}

                <div className="flex items-center justify-between gap-3">
                  <time dateTime={item.updatedAt} className="text-tiny text-ink-dim">
                    更新于 {formatUpdatedAt(item.updatedAt)}
                  </time>
                  {recording && <LiveAudioButton url={liveAudioUrl(item.roomId)} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
