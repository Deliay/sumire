"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Expand, Loader2, Maximize, Minimize, Pause, Play, Shrink, Volume2, X } from "lucide-react";
import { recordingFileUrl, type RecordingFile } from "@/features/recordings/api";
import { seekUnbuffered } from "@/features/recordings/seek";
import {
  configureBufferForBitrate,
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

type FullscreenMode = "none" | "native" | "web";

/** seek 成功发起后等待真实续播的看门狗超时：超时未恢复播放则显性提示失败（禁止静默冻结）。 */
const SEEK_WATCHDOG_MS = 15000;

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 目标时间是否已落在已缓冲区间内（已缓冲维持原生 currentTime 路径）。 */
function isTimeBuffered(video: HTMLVideoElement, time: number): boolean {
  try {
    const buffered = video.buffered;
    if (!buffered) return false;
    for (let i = 0; i < buffered.length; i++) {
      if (time >= buffered.start(i) && time < buffered.end(i)) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** 录播在线预览区（F5）：mpegts.js 视频播放（可见画面 + 可拖动进度条）、全屏/网页全屏，MSE 不可用时降级为下载。 */
export default function FlvPlayerPanel({ roomId, file, onClose }: FlvPlayerPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekTokenRef = useRef(0);
  const seekWatchdogRef = useRef<number | null>(null);
  const seekBeforeRef = useRef(0);
  const bufferDurationRef = useRef(0);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<FullscreenMode>("none");
  // 能力检测 Fullscreen API（不可用时隐藏「全屏」入口，网页全屏不受影响）；静态能力，惰性求值一次
  const [nativeAvailable] = useState(
    () => typeof document !== "undefined" && Boolean(document.fullscreenEnabled && Element.prototype.requestFullscreen),
  );
  // 上游 Range 支持（null=检测中）：决定进度条能否拖动 seek
  const [rangeSupported, setRangeSupported] = useState<boolean | null>(null);

  const url = recordingFileUrl(roomId, file.name);

  // 播放归属由全局单例维护：被「听直播」等其它流接管时自动复位为未播放
  const activeUrl = useSyncExternalStore(subscribePlayer, getPlayingUrl, () => null);
  const owns = activeUrl === url;
  const playing = owns && !paused;
  const canSeek = rangeSupported === true && Number.isFinite(duration) && duration > 0;

  const clearSeekWatchdog = useCallback(() => {
    if (seekWatchdogRef.current !== null) {
      window.clearTimeout(seekWatchdogRef.current);
      seekWatchdogRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    clearSeekWatchdog();
    setFailed(false);
    setPaused(false);
    setSeeking(false);
    setCurrentTime(0);
    setDuration(0);
    void play(url, video, {
      isLive: false,
      fileSize: file.size,
      onError: () => {
        setFailed(true);
        destroyPlayer(url);
      },
    });
  }, [url, file.size, clearSeekWatchdog]);

  // 卸载清理 seek 看门狗
  useEffect(() => clearSeekWatchdog, [clearSeekWatchdog]);

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

  // ESC / 浏览器退出原生全屏时同步按钮态
  useEffect(() => {
    const onChange = () => {
      const isNative = document.fullscreenElement != null && document.fullscreenElement === containerRef.current;
      setFullscreenMode((prev) => (isNative ? "native" : prev === "native" ? "none" : prev));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // 组件卸载（切换文件/离开页面）时退出原生全屏
  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (document.fullscreenElement != null && document.fullscreenElement === container) {
        void document.exitFullscreen?.();
      }
    };
  }, []);

  // 网页全屏：ESC 退出 + body 滚动锁定
  useEffect(() => {
    if (fullscreenMode !== "web") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenMode("none");
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreenMode]);

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
    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration);
    // 时长到手后按真实码率重算缓冲上限（一次）
    if (nextDuration > 0 && bufferDurationRef.current !== nextDuration) {
      bufferDurationRef.current = nextDuration;
      configureBufferForBitrate(file.size, nextDuration);
    }
    // 续播已实际发生（currentTime 变化）：解除 seek 看门狗
    if (seekWatchdogRef.current !== null && video.currentTime !== seekBeforeRef.current) {
      clearSeekWatchdog();
    }
  };

  const handleSeek = (value: number) => {
    const video = videoRef.current;
    if (!video || !canSeek) return;
    // 已缓冲：原生 currentTime 即时定位（mpegts buffered 分支）
    if (isTimeBuffered(video, value)) {
      video.currentTime = value;
      setCurrentTime(value);
      return;
    }
    // 未缓冲：走近似 seek 编排，不再写 currentTime（避免触发 50ms 校正死循环）
    const token = ++seekTokenRef.current;
    setSeeking(true);
    void seekUnbuffered({
      url,
      targetSeconds: value,
      durationSeconds: duration,
      fileSize: file.size,
    }).then((ok) => {
      if (token !== seekTokenRef.current) return;
      setSeeking(false);
      if (!ok) {
        setFailed(true);
        return;
      }
      // 已成功发起 patched 续播：看门狗确保「无续播」时显性提示而非静默冻结
      seekBeforeRef.current = video.currentTime;
      clearSeekWatchdog();
      seekWatchdogRef.current = window.setTimeout(() => {
        seekWatchdogRef.current = null;
        if (token !== seekTokenRef.current) return;
        setFailed(true);
      }, SEEK_WATCHDOG_MS);
    });
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

  const handleNativeToggle = () => {
    if (fullscreenMode === "native") {
      void document.exitFullscreen?.();
      return;
    }
    if (fullscreenMode === "web") setFullscreenMode("none");
    const container = containerRef.current;
    if (!container || typeof container.requestFullscreen !== "function") return;
    void container.requestFullscreen().then(() => setFullscreenMode("native")).catch(() => {});
  };

  const handleWebToggle = () => {
    if (fullscreenMode === "web") {
      setFullscreenMode("none");
      return;
    }
    if (fullscreenMode === "native") {
      void document.exitFullscreen?.();
    }
    setFullscreenMode("web");
  };

  const handleClose = () => {
    if (fullscreenMode === "native") void document.exitFullscreen?.();
    setFullscreenMode("none");
    destroyPlayer(url);
    onClose();
  };

  const containerClass =
    fullscreenMode === "web"
      ? "fixed inset-0 z-50 flex flex-col justify-center gap-3 bg-black p-4"
      : fullscreenMode === "native"
        ? "flex h-full w-full flex-col justify-center gap-3 bg-black p-4"
        : "flex flex-col gap-3";

  const iconButtonClass =
    "inline-flex size-9 items-center justify-center rounded-full border border-vine text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower";

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
        <div ref={containerRef} data-fullscreen-container className={containerClass}>
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
              onSeeked={clearSeekWatchdog}
            />
          </div>

          <div className="flex flex-col gap-2">
            <input
              type="range"
              aria-label="播放进度"
              aria-busy={seeking}
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
                aria-busy={seeking}
                className={iconButtonClass}
              >
                {playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
              </button>

              <span className="text-tiny text-ink-dim" aria-label="播放时间">
                {formatClock(currentTime)} / {formatClock(duration)}
              </span>

              {seeking && (
                <span role="status" aria-label="缓冲中" className="inline-flex items-center gap-1 text-tiny text-ink-dim">
                  <Loader2 size={12} className="animate-spin" aria-hidden /> 缓冲中…
                </span>
              )}

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

              {nativeAvailable && (
                <button
                  type="button"
                  onClick={handleNativeToggle}
                  aria-label={fullscreenMode === "native" ? "退出全屏" : "全屏"}
                  className={iconButtonClass}
                >
                  {fullscreenMode === "native" ? <Minimize size={15} aria-hidden /> : <Maximize size={15} aria-hidden />}
                </button>
              )}

              <button
                type="button"
                onClick={handleWebToggle}
                aria-label={fullscreenMode === "web" ? "退出网页全屏" : "网页全屏"}
                className={iconButtonClass}
              >
                {fullscreenMode === "web" ? <Shrink size={15} aria-hidden /> : <Expand size={15} aria-hidden />}
              </button>
            </div>

            {rangeSupported === false && <p className="text-tiny text-ink-dim">当前上游不支持拖动进度</p>}
          </div>

          {failed && (
            <p role="alert" className="text-small text-crimson">
              播放失败，请稍后重试或下载后收听。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
