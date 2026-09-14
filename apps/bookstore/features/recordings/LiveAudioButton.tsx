"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Headphones, Square } from "lucide-react";
import { destroyPlayer, getPlayingUrl, play, subscribePlayer } from "@/features/recordings/player";

/** 「听直播」按钮：点击经全局单例 player 播放实时音频流，播放中变「停止」。 */
export default function LiveAudioButton({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  // 播放归属由全局单例维护：他处接管播放时本按钮自动复位为「听直播」
  const activeUrl = useSyncExternalStore(subscribePlayer, getPlayingUrl, () => null);
  const playing = activeUrl === url;

  // 卸载清理仅销毁本组件所属的流，避免误断其它组件正在播放的流
  useEffect(() => () => destroyPlayer(url), [url]);

  const handleClick = () => {
    if (playing) {
      destroyPlayer(url);
      setFailed(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    void play(url, video, {
      isLive: true,
      onError: () => {
        setFailed(true);
        destroyPlayer(url);
      },
    });
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
