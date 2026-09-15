/** 录播播放器单例：mpegts.js 仅在浏览器运行时动态加载（避免 SSG 期求值浏览器全局）。 */

type MpegtsModule = typeof import("mpegts.js");
type Mpegts = MpegtsModule["default"];
type MpegtsPlayer = ReturnType<Mpegts["createPlayer"]>;

/** 全局唯一 player 实例引用（保证任何时刻至多一路播放）。 */
let currentPlayer: MpegtsPlayer | null = null;
/** 当前播放归属的流地址（用于卸载清理按归属判断、供组件校正 UI）。 */
let currentUrl: string | null = null;
let loadPromise: Promise<Mpegts> | null = null;
/** 播放代次：play 异步加载期间被 destroy/supersede 时用于丢弃过期实例。 */
let generation = 0;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 订阅当前播放归属变化（供组件以 useSyncExternalStore 校正播放态）。 */
export function subscribePlayer(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 当前正在播放的流地址（无播放为 null）。 */
export function getPlayingUrl(): string | null {
  return currentUrl;
}

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

/**
 * 探测上游是否支持 HTTP Range（决定进度条能否拖动 seek）。
 * 发起 `Range: bytes=0-0` 轻量请求，读响应头后立即取消响应体，避免大文件流量。
 */
export async function probeSeekable(url: string): Promise<boolean> {
  const controller = new AbortController();
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: controller.signal });
    const ok = res.status === 206 || res.headers.get("accept-ranges") === "bytes";
    controller.abort();
    try {
      await res.body?.cancel();
    } catch {
      // 取消失败忽略
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * 销毁当前 player（幂等）。
 * 传入 `url` 时仅当当前播放正归属该 url 才销毁——组件卸载清理用，避免误断其它组件的播放。
 */
export function destroyPlayer(url?: string): void {
  if (url !== undefined && currentUrl !== url) return;
  generation += 1;
  if (currentPlayer) {
    try {
      currentPlayer.destroy();
    } catch {
      // destroy 失败忽略，避免影响 UI 复位
    }
  }
  const changed = currentPlayer !== null || currentUrl !== null;
  currentPlayer = null;
  currentUrl = null;
  if (changed) emit();
}

/** 以 FLV 加载指定 url（先销毁旧实例，保证单例）。 */
export async function play(url: string, videoEl: HTMLVideoElement, options: PlayOptions): Promise<void> {
  if (currentUrl === url && currentPlayer) return;
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
  currentUrl = url;
  emit();
}

/** 暂停当前 player（无实例时忽略）。 */
export function pausePlayer(): void {
  currentPlayer?.pause();
}

/** 继续播放当前 player（无实例时忽略）。 */
export function resumePlayer(): void {
  void currentPlayer?.play();
}
