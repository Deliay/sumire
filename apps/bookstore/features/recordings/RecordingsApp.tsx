"use client";

import PageHeader from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";
import SectionHeader from "@/components/layout/SectionHeader";
import { RECORDINGS_CONFIGURED } from "@/features/recordings/api";
import RecordingsEmpty from "@/features/recordings/RecordingsEmpty";
import RecordingStatusList from "@/features/recordings/RecordingStatusList";
import RoomRecordingsGroup from "@/features/recordings/RoomRecordingsGroup";
import { useRecordingStatus } from "@/features/recordings/useRecordingStatus";

/** 录播页客户端主体：实时录制状态（F2/F3）+ 录播列表（F4，入口跳转回放页）。 */
export default function RecordingsApp() {
  const status = useRecordingStatus();

  if (!RECORDINGS_CONFIGURED) {
    return (
      <PageShell width="wide">
        <RecordingsEmpty reason="unconfigured" />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Recordings"
        title="录播"
        lead="实时录制状态、在线收听直播音频与历史录播回看。"
      />

      <div className="mt-10 flex flex-col gap-12">
        <RecordingStatusList state={status} />

        {status.kind === "ok" && status.items.length > 0 && (
          <section aria-labelledby="recordings-list-heading" className="flex flex-col gap-4">
            <SectionHeader title="录播列表" className="pb-4" />
            <span id="recordings-list-heading" className="sr-only">
              录播列表
            </span>
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
    </PageShell>
  );
}
