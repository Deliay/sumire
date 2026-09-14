"use client";

import { useEffect, useRef, useState } from "react";
import mpegts from "mpegts.js";
import { Download, Pause, Play, Volume2, X } from "lucide-react";
import { recordingFileUrl, type RecordingFile } from "@/features/recordings/api";
import { destroyPlayer, pausePlayer, play, resumePlayer } from "@/features/recordings/player";

interface FlvPlayerPanelProps {
  roomId: number;
  file: RecordingFile;
  onClose: () => void;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 录播在线预览区（F5）：mpegts.js 顺序流播放，MSE 不可用时降级为下载。 */
export default function FlvPlayerPanel({ roomId, file, onClose }: FlvPlayerPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported] = useState(() => mpegts.isSupported());
  const [playing, setPlaying] = useState(true);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  const url = recordingFileUrl(roomId, file.name);

  useEffect(() => {
    if (!supported) return;
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setPlaying(true);
    setCurrentTime(0);
    play(url, video, {
      isLive: false,
      onError: () => {
        setFailed(true);
        setPlaying(false);
      },
    });
    return () => destroyPlayer();
  }, [url, supported]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    if (playing) {
      pausePlayer();
      setPlaying(false);
    } else {
      resumePlayer();
      setPlaying(true);
    }
  };

  const handleClose = () => {
    destroyPlayer();
    onClose();
  };

  return (
    <section
      aria-label="录播播放区"
      className="flex flex-col gap-3 rounded-2xl border border-vine/60 bg-raised px-5 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate font-serif text-ink">{file.name}</h3>
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭播放区"
          className="shrink-0 text-ink-dim transition-colors hover:text-flower focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {!supported ? (
        <div className="flex flex-col gap-3 rounded-xl border border-vine/40 bg-night/40 px-4 py-5 text-small text-ink-dim">
          <p>当前浏览器不支持在线播放，请下载后收听。</p>
          <a
            href={url}
            download
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-vine px-3 py-1 text-tiny text-ink-dim transition-colors hover:border-flower hover:text-ink"
          >
            <Download size={13} aria-hidden /> 下载
          </a>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            hidden
            aria-hidden
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "暂停" : "播放"}
              className="inline-flex size-9 items-center justify-center rounded-full border border-vine text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
            >
              {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            </button>

            <span className="flex items-center gap-1.5 text-tiny text-ink-dim">
              <Volume2 size={14} aria-hidden />
              <input
                type="range"
                aria-label="音量"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-24 accent-flower"
              />
            </span>

            <span className="text-tiny text-ink-dim" aria-label="已播放时长">
              已播放 {formatClock(currentTime)}
            </span>
          </div>

          {failed && (
            <p role="alert" className="text-small text-crimson">
              播放失败，请稍后重试或下载后收听。
            </p>
          )}
        </>
      )}
    </section>
  );
}
