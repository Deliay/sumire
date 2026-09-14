/** 录播播放器单例：mpegts.js 仅在浏览器运行时动态加载（避免 SSG 期求值浏览器全局）。 */

type MpegtsModule = typeof import("mpegts.js");
type Mpegts = MpegtsModule["default"];
type MpegtsPlayer = ReturnType<Mpegts["createPlayer"]>;

/** 全局唯一 player 实例引用（保证任何时刻至多一路播放）。 */
let currentPlayer: MpegtsPlayer | null = null;
let loadPromise: Promise<Mpegts> | null = null;
/** 播放代次：play 异步加载期间被 destroy/supersede 时用于丢弃过期实例。 */
let generation = 0;

function loadMpegts(): Promise<Mpegts> {
  loadPromise ??= import("mpegts.js").then((mod) => mod.default);
  return loadPromise;
}

export interface PlayOptions {
  isLive: boolean;
  onError?: () => void;
}

/** 浏览器是否支持 MSE 在线播放（iOS Safari 通常为 false）。 */
export async function isPlaybackSupported(): Promise<boolean> {
  const mpegts = await loadMpegts();
  return mpegts.isSupported();
}

/** 销毁当前 player（幂等）；组件卸载/切换流前调用。 */
export function destroyPlayer(): void {
  generation += 1;
  if (!currentPlayer) return;
  try {
    currentPlayer.destroy();
  } catch {
    // destroy 失败忽略，避免影响 UI 复位
  }
  currentPlayer = null;
}

/** 以 FLV 加载指定 url（先销毁旧实例，保证单例）。 */
export async function play(url: string, videoEl: HTMLVideoElement, options: PlayOptions): Promise<void> {
  destroyPlayer();
  const token = generation;
  const mpegts = await loadMpegts();
  // 加载期间已被新的播放/销毁取代：丢弃本次
  if (token !== generation) return;
  const player = mpegts.createPlayer({ type: "flv", isLive: options.isLive, url });
  player.attachMediaElement(videoEl);
  if (options.onError) {
    player.on(mpegts.Events.ERROR, options.onError);
  }
  player.load();
  void player.play();
  currentPlayer = player;
}

/** 暂停当前 player（无实例时忽略）。 */
export function pausePlayer(): void {
  currentPlayer?.pause();
}

/** 继续播放当前 player（无实例时忽略）。 */
export function resumePlayer(): void {
  void currentPlayer?.play();
}
