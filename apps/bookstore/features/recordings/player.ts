import mpegts from "mpegts.js";

/** 全局唯一 player 实例引用（保证任何时刻至多一路播放）。 */
let currentPlayer: ReturnType<typeof mpegts.createPlayer> | null = null;

export interface PlayOptions {
  isLive: boolean;
  onError?: () => void;
}

/** 销毁当前 player（幂等）；组件卸载/切换流前调用。 */
export function destroyPlayer(): void {
  if (!currentPlayer) return;
  try {
    currentPlayer.destroy();
  } catch {
    // destroy 失败忽略，避免影响 UI 复位
  }
  currentPlayer = null;
}

/** 以 FLV 加载指定 url（先销毁旧实例，保证单例）。 */
export function play(url: string, videoEl: HTMLVideoElement, options: PlayOptions): void {
  destroyPlayer();
  const player = mpegts.createPlayer({ type: "flv", isLive: options.isLive, url });
  player.attachMediaElement(videoEl);
  if (options.onError) {
    player.on(mpegts.Events.ERROR, options.onError);
  }
  player.load();
  void player.play();
  currentPlayer = player;
}
