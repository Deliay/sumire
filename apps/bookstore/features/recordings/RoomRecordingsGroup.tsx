"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  getRoomRecordings,
  recordingFileUrl,
  type RecordingFile,
} from "@/features/recordings/api";
import { formatCreatedAt, formatFileSize } from "@/features/recordings/format";

const PAGE_SIZE = 20;

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; files: RecordingFile[] }
  | { kind: "error" };

interface RoomRecordingsGroupProps {
  roomId: number;
  streamerName: string;
  /** 点击文件项回调（在线预览）。 */
  onSelectFile?: (file: RecordingFile) => void;
  /** 当前选中文件名（高亮）。 */
  selectedFileName?: string | null;
}

/** 单直播间录播分组（F4）：折叠展开按需拉取一次、createdAt 倒序、前端分页。 */
export default function RoomRecordingsGroup({
  roomId,
  streamerName,
  onSelectFile,
  selectedFileName,
}: RoomRecordingsGroupProps) {
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
    <div className="rounded-2xl border border-vine/50 bg-raised/60">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:text-flower focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
      >
        <span className="flex items-center gap-2 font-serif text-ink">
          {expanded ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
          {streamerName}
        </span>
        <span className="text-tiny text-ink-dim">{expanded ? "收起" : "展开"}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-vine/30 px-5 py-4">
          {state.kind === "loading" && <p className="text-small text-ink-dim">正在加载录播列表…</p>}

          {state.kind === "error" && (
            <div className="flex items-center gap-3 text-small text-ink-dim">
              <span>录播列表加载失败。</span>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-vine px-3 py-1 text-tiny transition-colors hover:border-flower hover:text-ink"
              >
                重试
              </button>
            </div>
          )}

          {state.kind === "ok" && sortedFiles.length === 0 && <p className="text-small text-ink-dim">暂无录播</p>}

          {state.kind === "ok" && sortedFiles.length > 0 && (
            <>
              <ul className="flex flex-col divide-y divide-vine/20">
                {pageFiles.map((file) => {
                  const selected = selectedFileName === file.name;
                  return (
                    <li key={file.name} className="flex items-center gap-3 py-2">
                      <button
                        type="button"
                        onClick={() => onSelectFile?.(file)}
                        aria-pressed={selected}
                        className={`flex-1 truncate text-left text-small transition-colors ${
                          selected ? "text-flower" : "text-ink hover:text-flower"
                        }`}
                      >
                        {file.name}
                      </button>
                      <span className="shrink-0 text-tiny text-ink-dim">{formatFileSize(file.size)}</span>
                      <time dateTime={file.createdAt} className="shrink-0 text-tiny text-ink-dim">
                        {formatCreatedAt(file.createdAt)}
                      </time>
                      <a
                        href={recordingFileUrl(roomId, file.name)}
                        download
                        className="shrink-0 text-tiny text-ink-dim transition-colors hover:text-flower"
                      >
                        下载
                      </a>
                    </li>
                  );
                })}
              </ul>

              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 text-tiny text-ink-dim">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-vine px-3 py-1 disabled:opacity-40"
                  >
                    上一页
                  </button>
                  <span>
                    第 {page} / {pageCount} 页
                  </span>
                  <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="rounded-full border border-vine px-3 py-1 disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
