"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RECORDINGS_CONFIGURED,
  getRoomRecordings,
  recordingFileUrl,
  type RecordingFile,
} from "@/features/recordings/api";
import { formatCreatedAt } from "@/features/recordings/format";
import ReplayStage from "./ReplayStage";

type ResolvedState =
  | { kind: "notfound" }
  | { kind: "error" }
  | { kind: "ok"; file: RecordingFile };

function ReplayEmpty({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-5 py-24 lg:px-10">
      <p className="text-ink-dim">{message}</p>
      <Link
        href="/recordings"
        className="rounded-full border border-vine px-4 py-1.5 text-small text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
      >
        返回录播列表
      </Link>
    </div>
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
      setResolved({ key: requestKey, state: match ? { kind: "ok", file: match } : { kind: "notfound" } });
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
      <div className="mx-auto w-full max-w-6xl px-5 py-24 lg:px-10">
        <p className="text-ink-dim">正在加载录播…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return <ReplayEmpty message="录播信息加载失败，请稍后重试。" />;
  }

  if (state.kind === "notfound") {
    return <ReplayEmpty message="录播不存在或已删除。" />;
  }

  const activeRoomId = roomId as number;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-24 lg:px-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-serif text-h1 text-ink">录播回放</h1>
        <p className="text-small text-ink-dim">
          {state.file.name} · 直播间 {activeRoomId} · {formatCreatedAt(state.file.createdAt)}
        </p>
      </header>

      <ReplayStage roomId={activeRoomId} file={state.file} />

      <div className="flex items-center gap-3">
        <a
          href={recordingFileUrl(activeRoomId, state.file.name)}
          download
          className="inline-flex items-center gap-1.5 rounded-full border border-vine px-4 py-1.5 text-small text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
        >
          下载该场录播
        </a>
        <Link
          href="/recordings"
          className="inline-flex items-center gap-1.5 rounded-full border border-vine px-4 py-1.5 text-small text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
        >
          返回录播列表
        </Link>
      </div>
    </div>
  );
}
