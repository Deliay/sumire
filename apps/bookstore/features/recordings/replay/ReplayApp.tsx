"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";
import Button from "@/components/ui/Button";
import { RECORDINGS_CONFIGURED, getRoomRecordings, type RecordingFile } from "@/features/recordings/api";
import { formatCreatedAt } from "@/features/recordings/format";
import ReplayStage from "./ReplayStage";
import { segmentBoundsForFile, type SegmentBounds } from "./replayWindows";

type ResolvedState =
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ok"; file: RecordingFile; bounds: SegmentBounds };

function ReplayEmpty({ message }: { message: string }) {
  return (
    <PageShell width="wide">
      <p className="text-ink-dim">{message}</p>
      <div className="mt-4">
        <Button href="/recordings" variant="secondary" size="sm">
          返回录播列表
        </Button>
      </div>
    </PageShell>
  );
}

/** 回放页客户端主体：解析并校验查询参数、回源文件元信息、装配舞台。 */
export default function ReplayApp() {
  const params = useSearchParams();
  const roomIdRaw = params.get("roomId");
  const fileParam = params.get("file");
  const roomId = roomIdRaw !== null && /^\d+$/.test(roomIdRaw) ? Number(roomIdRaw) : null;
  const valid = roomId !== null && roomId > 0 && fileParam !== null && fileParam !== "";
  const requestKey =
    RECORDINGS_CONFIGURED && valid && roomId !== null && fileParam !== null ? `${roomId}\u0000${fileParam}` : null;

  const [resolved, setResolved] = useState<{ key: string; state: ResolvedState } | null>(null);

  useEffect(() => {
    if (requestKey === null || roomId === null || !fileParam) return;
    let active = true;
    void getRoomRecordings(roomId).then((res) => {
      if (!active) return;
      if (!res.ok) {
        setResolved({ key: requestKey, state: { kind: "error" } });
        return;
      }
      const match = res.files.find((file) => file.name === fileParam);
      setResolved({
        key: requestKey,
        state: match ? { kind: "ok", file: match, bounds: segmentBoundsForFile(res.files, match) } : { kind: "notfound" },
      });
    });
    return () => {
      active = false;
    };
  }, [requestKey, roomId, fileParam]);

  if (!RECORDINGS_CONFIGURED) {
    return <ReplayEmpty message="录播服务未配置，暂时无法回放。" />;
  }

  if (!valid) {
    return <ReplayEmpty message="参数无效：缺少有效的 roomId 或 file。" />;
  }

  const state = resolved !== null && resolved.key === requestKey ? resolved.state : null;

  if (state === null) {
    return (
      <PageShell width="wide">
        <p className="text-ink-dim">正在加载录播…</p>
      </PageShell>
    );
  }

  if (state.kind === "error") {
    return <ReplayEmpty message="录播信息加载失败，请稍后重试。" />;
  }

  if (state.kind === "notfound") {
    return <ReplayEmpty message="录播不存在或已删除。" />;
  }

  const activeRoomId = roomId as number;
  const sessionTitle = state.file.info?.title?.trim();
  const sessionStart = state.file.info?.startedAt || state.file.createdAt;
  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Replay"
        title="录播回放"
        lead={`${sessionTitle ? `${sessionTitle} · ` : ""}${state.file.name} · 直播间 ${activeRoomId} · ${formatCreatedAt(sessionStart)}`}
      />

      <div className="mt-6">
        <ReplayStage roomId={activeRoomId} file={state.file} bounds={state.bounds} />
      </div>
    </PageShell>
  );
}
