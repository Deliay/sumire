"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Pause, Play, Volume2, X } from "lucide-react";
import { recordingFileUrl, type RecordingFile } from "@/features/recordings/api";
import {
  destroyPlayer,
  getPlayingUrl,
  isPlaybackSupported,
  pausePlayer,
  play,
  probeSeekable,
  resumePlayer,
  subscribePlayer,
} from "@/features/recordings/player";

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

/** 录播在线预览区（F5）：mpegts.js 视频播放（可见画面 + 可拖动进度条），MSE 不可用时降级为下载。 */
export default function FlvPlayerPanel({ roomId, file, onClose }: FlvPlayerPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // 上游 Range 支持（null=检测中）：决定进度条能否拖动 seek
  const [rangeSupported, setRangeSupported] = useState<boolean | null>(null);

  const url = recordingFileUrl(roomId, file.name);

  // 播放归属由全局单例维护：被「听直播」等其它流接管时自动复位为未播放
  const activeUrl = useSyncExternalStore(subscribePlayer, getPlayingUrl, () => null);
  const owns = activeUrl === url;
  const playing = owns && !paused;
  const canSeek = rangeSupported === true && Number.isFinite(duration) && duration > 0;

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    void play(url, video, {
      isLive: false,
      onError: () => {
        setFailed(true);
        destroyPlayer(url);
      },
    });
  }, [url]);

  useEffect(() => {
    let active = true;
    void isPlaybackSupported().then((ok) => {
      if (active) setSupported(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  // 探测上游 Range 支持（失败/不支持则进度条禁用并明示）
  useEffect(() => {
    let active = true;
    void probeSeekable(url).then((ok) => {
      if (active) setRangeSupported(ok);
    });
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    if (supported !== true) return;
    start();
    return () => destroyPlayer(url);
  }, [url, supported, start]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  const syncMediaState = (video: HTMLVideoElement) => {
    setCurrentTime(video.currentTime);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  };

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video || !canSeek) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const togglePlay = () => {
    if (!owns) {
      // 本流已被接管或已停止：重新加载本录播
      start();
      return;
    }
    if (paused) {
      resumePlayer();
      setPaused(false);
    } else {
      pausePlayer();
      setPaused(true);
    }
  };

  const handleClose = () => {
    destroyPlayer(url);
    onClose();
  };

  return (
    <section
      aria-label="录播播放区"
      className="flex flex-col gap-3 rounded-xl border border-vine/50 bg-night/40 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-tiny text-ink-dim">{file.name}</span>
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭播放区"
          className="shrink-0 text-ink-dim transition-colors hover:text-flower focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {supported === null && <p className="text-small text-ink-dim">正在准备播放器…</p>}

      {supported === false && (
        <div className="flex flex-col gap-3 rounded-lg border border-vine/40 bg-night/40 px-4 py-5 text-small text-ink-dim">
          <p>当前浏览器不支持在线播放，请下载后收听。</p>
          <a
            href={url}
            download
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-vine px-3 py-1 text-tiny text-ink-dim transition-colors hover:border-flower hover:text-ink"
          >
            <Download size={13} aria-hidden /> 下载
          </a>
        </div>
      )}

      {supported === true && (
        <>
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              aria-label="录播视频"
              playsInline
              className="h-full w-full"
              onTimeUpdate={(e) => syncMediaState(e.currentTarget)}
              onLoadedMetadata={(e) => syncMediaState(e.currentTarget)}
              onDurationChange={(e) => syncMediaState(e.currentTarget)}
              onProgress={(e) => syncMediaState(e.currentTarget)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="range"
              aria-label="播放进度"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              disabled={!canSeek}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full accent-flower disabled:opacity-40"
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

              <span className="text-tiny text-ink-dim" aria-label="播放时间">
                {formatClock(currentTime)} / {formatClock(duration)}
              </span>

              <span className="ml-auto flex items-center gap-1.5 text-tiny text-ink-dim">
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
            </div>

            {rangeSupported === false && <p className="text-tiny text-ink-dim">当前上游不支持拖动进度</p>}
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
