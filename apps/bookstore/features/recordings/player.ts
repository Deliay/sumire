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
  /** 文件字节大小（录播用），用于按码率折算缓冲上限。 */
  fileSize?: number;
}

/** 播放 buffer 字节预算上限（前瞻 + 回退），约 50MB。 */
export const BUFFER_BUDGET_BYTES = 50 * 1024 * 1024;
/** 前瞻/回退缓冲秒数下限（防止极低码率下缓冲过小）。 */
const MIN_BUFFER_SECONDS = 30;
/** 前瞻/回退缓冲秒数上限（防止极低码率下缓冲过大）。 */
const MAX_BUFFER_SECONDS = 120;
/** 未知码率时的保守默认码率（bps），按录播产物上界取值以兜底封顶。 */
const DEFAULT_BITRATE_BPS = 10_000_000;

export interface BufferConfig {
  lazyLoadMaxDuration: number;
  lazyLoadRecoverDuration: number;
  autoCleanupMaxBackwardDuration: number;
  autoCleanupMinBackwardDuration: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 按 `size/duration` 估算码率，把 mpegts 的 lazyLoad / autoCleanup 缓冲窗口
 * 折算到 ≤ `BUFFER_BUDGET_BYTES` 对应的秒数（纯函数，带合理上下限）。
 * `durationSeconds` 未知（≤0）时用保守默认码率兜底。
 */
export function computeBufferConfig(fileSize: number, durationSeconds: number): BufferConfig {
  const validSize = Number.isFinite(fileSize) && fileSize > 0 ? fileSize : 0;
  const validDuration = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;
  const bitrate = validSize > 0 && validDuration > 0 ? (validSize * 8) / validDuration : DEFAULT_BITRATE_BPS;
  const budgetSeconds = Math.floor((BUFFER_BUDGET_BYTES * 8) / bitrate);
  const forward = clamp(budgetSeconds, MIN_BUFFER_SECONDS, MAX_BUFFER_SECONDS);
  return {
    lazyLoadMaxDuration: forward,
    lazyLoadRecoverDuration: clamp(Math.floor(forward / 6), 5, MAX_BUFFER_SECONDS),
    autoCleanupMaxBackwardDuration: forward,
    autoCleanupMinBackwardDuration: clamp(Math.floor(forward / 3), 10, MAX_BUFFER_SECONDS),
  };
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

type PatchedPlayer = MpegtsPlayer & {
  seekToByteOffset?: (fileposition: number, milliseconds: number) => void;
  setBufferLimits?: (limits: Partial<BufferConfig>) => void;
};

/** 以 FLV 加载指定 url（先销毁旧实例，保证单例）。 */
export async function play(url: string, videoEl: HTMLVideoElement, options: PlayOptions): Promise<void> {
  if (currentUrl === url && currentPlayer) return;
  destroyPlayer();
  const token = generation;
  const mpegts = await loadMpegts();
  // 加载期间已被新的播放/销毁取代：丢弃本次
  if (token !== generation) return;
  // 非直播（录播）显式封顶缓冲：以确定性默认码率折算，避免走 mpegts 默认 180s 前瞻缓冲
  const config = options.isLive ? undefined : computeBufferConfig(options.fileSize ?? 0, 0);
  const player = mpegts.createPlayer({ type: "flv", isLive: options.isLive, url }, config) as PatchedPlayer;
  if (typeof player.seekToByteOffset !== "function") {
    // 补丁未生效：显性暴露（严禁静默冻结），后续 seek 会走失败提示
    console.error("[recordings] mpegts.js 字节偏移续播补丁未生效：播放器实例缺少 seekToByteOffset");
  }
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

/**
 * 按文件大小与已知时长重算缓冲上限并应用到当前 player（幂等）。
 * 依赖 patched `setBufferLimits`；无实例/patch 未生效时返回 false。
 */
export function configureBufferForBitrate(fileSize: number, durationSeconds: number): boolean {
  const player = currentPlayer as PatchedPlayer | null;
  const apply = player?.setBufferLimits;
  if (typeof apply !== "function") return false;
  try {
    apply.call(player, computeBufferConfig(fileSize, durationSeconds));
    return true;
  } catch (error) {
    console.error("[recordings] 应用缓冲上限失败", error);
    return false;
  }
}

/**
 * 从字节偏移续播（依赖 mpegts.js patch 暴露的 `seekToByteOffset`）。
 * 返回是否已成功触达 patched 实例方法；无实例/patch 未生效/调用异常时
 * **显性记录错误并返回 false**（不改变 `currentUrl`/代次语义，由调用方展示失败提示）。
 */
export function seekToByteOffset(fileposition: number, milliseconds: number): boolean {
  const player = currentPlayer as PatchedPlayer | null;
  if (!player) {
    console.error("[recordings] seekToByteOffset: 当前无播放实例");
    return false;
  }
  const apply = player.seekToByteOffset;
  if (typeof apply !== "function") {
    console.error("[recordings] seekToByteOffset: mpegts.js 补丁未生效（实例缺少方法）");
    return false;
  }
  try {
    apply.call(player, fileposition, milliseconds);
    return true;
  } catch (error) {
    console.error("[recordings] seekToByteOffset: patched 方法内部结构不符，续播不可用", error);
    return false;
  }
}

/** 暂停当前 player（无实例时忽略）。 */
export function pausePlayer(): void {
  currentPlayer?.pause();
}

/** 继续播放当前 player（无实例时忽略）。 */
export function resumePlayer(): void {
  void currentPlayer?.play();
}
