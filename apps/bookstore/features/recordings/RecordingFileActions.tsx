"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, Play } from "lucide-react";
import { recordingFileUrl, recordingReplayHref, type RecordingFile } from "@/features/recordings/api";
import { useDismiss } from "@/features/schedule/useDismiss";

interface RecordingFileActionsProps {
  roomId: number;
  file: RecordingFile;
}

const SEGMENT_CLASS =
  "inline-flex items-center gap-1 px-2.5 py-1 text-tiny text-ink-dim transition-colors hover:text-flower focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower";

/** 录播文件项操作按钮组：主入口「播放」为新标签页回放页链接 + `▾` 下拉菜单（下载）。 */
export default function RecordingFileActions({ roomId, file }: RecordingFileActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismiss(containerRef, menuOpen, () => setMenuOpen(false));

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <div className="flex items-stretch overflow-hidden rounded-full border border-vine">
        <a
          href={recordingReplayHref(roomId, file.name)}
          target="_blank"
          rel="noopener noreferrer"
          className={SEGMENT_CLASS}
        >
          <Play size={12} aria-hidden />
          播放
        </a>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="更多操作"
          className={`${SEGMENT_CLASS} border-l border-vine`}
        >
          <ChevronDown size={14} aria-hidden />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-[80] mt-1 min-w-[8rem] rounded-md border border-vine/50 bg-raised shadow-xl"
        >
          <a
            role="menuitem"
            href={recordingFileUrl(roomId, file.name)}
            download
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-tiny text-ink-dim transition-colors hover:bg-soft hover:text-ink"
          >
            <Download size={13} aria-hidden /> 下载
          </a>
        </div>
      )}
    </div>
  );
}
