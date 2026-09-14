"use client";

import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import RecordingsEmpty from "@/features/recordings/RecordingsEmpty";
import RecordingStatusList from "@/features/recordings/RecordingStatusList";
import RoomRecordingsGroup from "@/features/recordings/RoomRecordingsGroup";
import { useRecordingStatus } from "@/features/recordings/useRecordingStatus";

/** 录播页客户端主体：实时录制状态（F2/F3）+ 录播列表（F4）+ 播放区（F5）。 */
export default function RecordingsApp() {
  const status = useRecordingStatus();

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

      <RecordingStatusList state={status} />

      {status.kind === "ok" && status.items.length > 0 && (
        <section aria-labelledby="recordings-list-heading" className="flex flex-col gap-4">
          <h2 id="recordings-list-heading" className="font-serif text-h2 text-ink">
            录播列表
          </h2>
          <ul className="flex flex-col gap-3">
            {status.items.map((item) => (
              <li key={item.roomId}>
                <RoomRecordingsGroup
                  roomId={item.roomId}
                  streamerName={item.streamerName || `直播间 ${item.roomId}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
