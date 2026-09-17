/**
 * canvas 浮层弹幕：轨道分配/调度纯函数 + canvas 渲染器。
 *
 * 纯函数（`assignLane`/`fontSizeForWidth`/`danmakuSpeed`/`danmakuOffsets`/`selectDanmakusToEmit`/
 * `isSeekJump`）不触碰 DOM，可在 node 环境单测；`createDanmakuRenderer` 惰性访问 canvas 2D，
 * 供 `DanmakuOverlay` 组件在浏览器中挂载。
 */

import type { LiveEvent } from "@/features/danmaku/types";
import { offsetMs } from "./replayWindows";

/** 同屏在飞弹幕上限；超出丢弃最早批次。 */
export const MAX_ACTIVE_DANMAKU = 50;
/** 单轨道高度（px），用于由视频高度推算轨道数。 */
export const LANE_HEIGHT = 28;
/** 同轨道两条弹幕之间的最小安全间距（px）。 */
export const MIN_LANE_GAP = 24;
/** 弹幕字号基准（px @1920 宽）。回放舞台常规宽度远小于 1920，故基准调大保证可读性。 */
export const BASE_FONT_SIZE = 32;
/** 弹幕字号下限（px）：窄舞台/小视频下仍清晰可读。 */
export const MIN_FONT_SIZE = 20;
export const BASE_VIDEO_WIDTH = 1920;
/** 弹幕横穿画面所需秒数（决定恒定速度）。 */
export const TRAVEL_SECONDS = 8;
/** 播放头回退或前跳超过该阈值（秒）判为 seek，清空浮层重建。 */
export const SEEK_JUMP_THRESHOLD_SECONDS = 2;
/** seek 重建时回放「最近多少秒内」的弹幕，避免落点画面空荡。 */
export const SEEK_REBUILD_SECONDS = 4;

export interface ActiveDanmaku {
  lane: number;
  /** 弹幕左缘 x 坐标（px，随时间左移）。 */
  x: number;
  /** 弹幕像素宽度。 */
  width: number;
  /** 左移速度（px/s）。 */
  speed: number;
}

/**
 * 字号随视频宽度线性缩放（基准 32px @1920），并钳到下限 `MIN_FONT_SIZE`；
 * 回放舞台常规宽度（约 900~1200px）下不低于 20px，双全屏 1920px 下达 32px，保证可读。
 * 非法输入回退基准。
 */
export function fontSizeForWidth(videoWidth: number): number {
  if (!Number.isFinite(videoWidth) || videoWidth <= 0) return BASE_FONT_SIZE;
  return Math.max(MIN_FONT_SIZE, Math.round((BASE_FONT_SIZE * videoWidth) / BASE_VIDEO_WIDTH));
}

/** 恒定左移速度（px/s）：与文本长度无关，保证可读。 */
export function danmakuSpeed(videoWidth: number): number {
  if (!Number.isFinite(videoWidth) || videoWidth <= 0) return 0;
  return videoWidth / TRAVEL_SECONDS;
}

/** 单轨道高度（px）：随字号放大（1.3 倍），至少 `LANE_HEIGHT`，保证相邻轨道不重叠。 */
export function laneHeightForWidth(videoWidth: number): number {
  return Math.max(LANE_HEIGHT, Math.round(fontSizeForWidth(videoWidth) * 1.3));
}

/** 按 16:9 视频高度与轨道高度推算轨道数。 */
export function laneCountForWidth(videoWidth: number): number {
  if (!Number.isFinite(videoWidth) || videoWidth <= 0) return 1;
  return Math.max(1, Math.floor((videoWidth * 9) / 16 / laneHeightForWidth(videoWidth)));
}

/**
 * 选择首个可用轨道：该轨道上最新弹幕的右缘须已完全进入画面并留出 `MIN_LANE_GAP`。
 * 全部轨道占用或同屏在飞数达 `MAX_ACTIVE_DANMAKU` 时返回 `null`（丢弃）。
 */
export function assignLane(
  active: ActiveDanmaku[],
  videoWidth: number,
  laneCount = laneCountForWidth(videoWidth),
): number | null {
  if (active.length >= MAX_ACTIVE_DANMAKU) return null;
  for (let lane = 0; lane < laneCount; lane++) {
    let free = true;
    for (const item of active) {
      if (item.lane !== lane) continue;
      if (item.x + item.width + MIN_LANE_GAP > videoWidth) {
        free = false;
        break;
      }
    }
    if (free) return lane;
  }
  return null;
}

/** 事件墙上时钟 → 相对录播偏移秒（仅 danmaku 类型）。 */
export function danmakuOffsets(events: LiveEvent[], recordStart: string): { event: LiveEvent; offsetSeconds: number }[] {
  const result: { event: LiveEvent; offsetSeconds: number }[] = [];
  for (const event of events) {
    if (event.type !== "danmaku") continue;
    const ms = offsetMs(event.occurredAt, recordStart);
    if (!Number.isFinite(ms)) continue;
    result.push({ event, offsetSeconds: ms / 1000 });
  }
  return result;
}

/** 选取 `(prev, next]` 区间内应发射的弹幕（播放前进时的增量）。 */
export function selectDanmakusToEmit<T extends { offsetSeconds: number }>(
  offsets: T[],
  prevSeconds: number,
  nextSeconds: number,
): T[] {
  return offsets.filter((item) => item.offsetSeconds > prevSeconds && item.offsetSeconds <= nextSeconds);
}

/** 播放头回退或前跳超过阈值判为 seek。 */
export function isSeekJump(prevSeconds: number, nextSeconds: number): boolean {
  return nextSeconds < prevSeconds || nextSeconds - prevSeconds > SEEK_JUMP_THRESHOLD_SECONDS;
}

export interface DanmakuInput {
  text?: string;
  emoteUrl?: string;
  emoteAlt?: string;
}

export interface DanmakuRenderer {
  enqueue(input: DanmakuInput): void;
  setPaused(paused: boolean): void;
  clear(): void;
  setMetrics(width: number, height: number, dpr: number): void;
  destroy(): void;
}

interface FlyingDanmaku extends ActiveDanmaku, DanmakuInput {}

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): HTMLImageElement {
  let image = imageCache.get(url);
  if (!image) {
    image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.src = url;
    imageCache.set(url, image);
  }
  return image;
}

/**
 * 创建 canvas 弹幕渲染器：rAF 驱动匀速左移、出画回收、暂停挂起、ResizeObserver 由调用方驱动
 * `setMetrics`。emote 图片经 `Image` 预载，未载完以 alt 文本占位。
 */
export function createDanmakuRenderer(
  canvas: HTMLCanvasElement,
  options: { color?: string; strokeColor?: string; fontFamily?: string } = {},
): DanmakuRenderer {
  const ctx = canvas.getContext("2d");
  let items: FlyingDanmaku[] = [];
  let width = canvas.clientWidth || BASE_VIDEO_WIDTH;
  let height = canvas.clientHeight || (BASE_VIDEO_WIDTH * 9) / 16;
  let dpr = 1;
  let paused = false;
  let rafId: number | null = null;
  let lastTs = 0;
  let destroyed = false;

  const color = options.color ?? "#ffffff";
  const strokeColor = options.strokeColor ?? "rgba(0, 0, 0, 0.85)";
  const fontFamily = options.fontFamily ?? "system-ui, sans-serif";

  function measure(input: DanmakuInput): number {
    const fontSize = fontSizeForWidth(width);
    if (input.emoteUrl) {
      const image = loadImage(input.emoteUrl);
      const base = image.naturalWidth > 0 ? image.naturalWidth : fontSize * 2;
      return Math.min(base, fontSize * 4);
    }
    if (!ctx) return (input.text?.length ?? 0) * fontSize * 0.6;
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    return ctx.measureText(input.text ?? "").width;
  }

  function draw(item: FlyingDanmaku) {
    if (!ctx) return;
    const fontSize = fontSizeForWidth(width);
    const laneHeight = laneHeightForWidth(width);
    const y = item.lane * laneHeight + laneHeight / 2 + fontSize / 2;
    if (item.emoteUrl) {
      const image = loadImage(item.emoteUrl);
      if (image.complete && image.naturalWidth > 0) {
        const ratio = image.naturalHeight > 0 ? image.naturalHeight / image.naturalWidth : 1;
        const w = Math.min(item.width, fontSize * 4);
        const h = w * ratio;
        ctx.drawImage(image, item.x, y - h + fontSize / 2, w, h);
      } else {
        ctx.font = `600 ${fontSize}px ${fontFamily}`;
        ctx.lineWidth = Math.max(2, fontSize * 0.12);
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = color;
        ctx.strokeText(item.emoteAlt ?? "", item.x, y);
        ctx.fillText(item.emoteAlt ?? "", item.x, y);
      }
      return;
    }
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    ctx.lineWidth = Math.max(2, fontSize * 0.12);
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = color;
    ctx.strokeText(item.text ?? "", item.x, y);
    ctx.fillText(item.text ?? "", item.x, y);
  }

  function frame(ts: number) {
    if (destroyed) return;
    const dt = lastTs === 0 ? 0 : Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
    }
    if (!paused) {
      for (const item of items) item.x -= item.speed * dt;
      items = items.filter((item) => item.x + item.width > 0);
    }
    for (const item of items) draw(item);
    rafId = typeof requestAnimationFrame === "function" ? requestAnimationFrame(frame) : null;
  }

  function ensureLoop() {
    if (rafId !== null || destroyed || typeof requestAnimationFrame !== "function") return;
    lastTs = 0;
    rafId = requestAnimationFrame(frame);
  }

  ensureLoop();

  return {
    enqueue(input) {
      const textWidth = measure(input);
      const lane = assignLane(items, width, laneCountForWidth(width));
      if (lane === null) return;
      items.push({ lane, x: width, width: textWidth, speed: danmakuSpeed(width), ...input });
      ensureLoop();
    },
    setPaused(next) {
      paused = next;
      ensureLoop();
    },
    clear() {
      items = [];
    },
    setMetrics(nextWidth, nextHeight, nextDpr) {
      if (Number.isFinite(nextWidth) && nextWidth > 0) width = nextWidth;
      if (Number.isFinite(nextHeight) && nextHeight > 0) height = nextHeight;
      if (Number.isFinite(nextDpr) && nextDpr > 0) dpr = nextDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ensureLoop();
    },
    destroy() {
      destroyed = true;
      if (rafId !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
      rafId = null;
      items = [];
    },
  };
}
