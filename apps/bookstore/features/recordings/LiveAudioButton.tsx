"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Square } from "lucide-react";
import { destroyPlayer, play } from "@/features/recordings/player";

interface LiveAudioButtonProps {
  roomId: number;
  url: string;
  playing: boolean;
  onStarted: () => void;
  onStopped: () => void;
}

/** 「听直播」按钮：点击经全局单例 player 播放实时音频流，播放中变「停止」。 */
export default function LiveAudioButton({ url, playing, onStarted, onStopped }: LiveAudioButtonProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => destroyPlayer(), []);

  const handleClick = () => {
    if (playing) {
      destroyPlayer();
      setFailed(false);
      onStopped();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    void play(url, video, {
      isLive: true,
      onError: () => {
        setFailed(true);
        onStopped();
      },
    });
    onStarted();
  };

  return (
    <div className="flex items-center gap-2">
      <video ref={videoRef} className="hidden" aria-hidden />
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={playing}
        className="inline-flex items-center gap-1.5 rounded-full border border-vine px-3 py-1 text-tiny text-ink-dim transition-colors hover:border-flower hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-flower"
      >
        {playing ? <Square size={13} aria-hidden /> : <Headphones size={13} aria-hidden />}
        {playing ? "停止" : "听直播"}
      </button>
      {failed && (
        <span role="alert" className="text-tiny text-crimson">
          音频流加载失败，请重试
        </span>
      )}
    </div>
  );
}
