"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getRoomRecordings, recordingReplayHref, type RecordingFile } from "@/features/recordings/api";
import { formatCreatedAt, formatFileSize } from "@/features/recordings/format";
import RecordingFileActions from "@/features/recordings/RecordingFileActions";
import Button from "@/components/ui/Button";

const PAGE_SIZE = 20;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; files: RecordingFile[] }
  | { kind: "error" };

interface RoomRecordingsGroupProps {
  roomId: number;
  streamerName: string;
}

/** 单直播间录播分组（F4）：折叠展开按需拉取一次、createdAt 倒序、前端分页；文件名/「播放」跳转回放页。 */
export default function RoomRecordingsGroup({ roomId, streamerName }: RoomRecordingsGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [page, setPage] = useState(1);

  const load = async () => {
    setPage(1);
    setState({ kind: "loading" });
    const res = await getRoomRecordings(roomId);
    setState(res.ok ? { kind: "ok", files: res.files } : { kind: "error" });
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && state.kind === "idle") {
      void load();
    }
  };

  const sortedFiles =
    state.kind === "ok"
      ? [...state.files].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      : [];
  const pageCount = Math.max(1, Math.ceil(sortedFiles.length / PAGE_SIZE));
  const pageFiles = sortedFiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="rounded-xs border border-line bg-raised/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
      >
        <span className="flex items-center gap-2 font-serif text-ink">
          {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          {streamerName}
        </span>
        <span className="font-mono text-tiny text-ink-dim">{expanded ? "收起" : "展开"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4">
          {state.kind === "loading" && <p className="text-small text-ink-dim">正在加载录播列表…</p>}

          {state.kind === "error" && (
            <div className="flex items-center gap-3 text-small text-ink-dim">
              <span>录播列表加载失败。</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void load()}
              >
                重试
              </Button>
            </div>
          )}

          {state.kind === "ok" && sortedFiles.length === 0 && <p className="text-small text-ink-dim">暂无录播</p>}

          {state.kind === "ok" && sortedFiles.length > 0 && (
            <>
              <ul className="flex flex-col divide-y divide-line">
                {pageFiles.map((file) => (
                  <li key={file.name} className="flex items-center gap-3 py-2">
                    <a
                      href={recordingReplayHref(roomId, file.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-left text-small text-ink transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
                    >
                      {file.name}
                    </a>
                    <span className="shrink-0 font-mono text-tiny text-ink-dim">{formatFileSize(file.size)}</span>
                    <time dateTime={file.createdAt} className="shrink-0 font-mono text-tiny text-ink-dim">
                      {formatCreatedAt(file.createdAt)}
                    </time>
                    <RecordingFileActions roomId={roomId} file={file} />
                  </li>
                ))}
              </ul>

              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 font-mono text-tiny text-ink-dim">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    上一页
                  </Button>
                  <span>
                    第 {page} / {pageCount} 页
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
