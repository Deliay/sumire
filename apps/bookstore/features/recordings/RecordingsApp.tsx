"use client";

import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import RecordingsEmpty from "@/features/recordings/RecordingsEmpty";
import RecordingStatusList from "@/features/recordings/RecordingStatusList";

/** 录播页客户端主体：实时录制状态（F2/F3）+ 录播列表（F4）+ 播放区（F5）。 */
export default function RecordingsApp() {
  if (!RECORDINGS_CONFIGURED) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 lg:px-10">
        <RecordingsEmpty reason="unconfigured" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-24 lg:px-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-h1 text-ink">录播</h1>
        <p className="text-ink-dim">实时录制状态、在线收听直播音频与历史录播回放。</p>
      </header>

      <RecordingStatusList />
    </div>
  );
}
