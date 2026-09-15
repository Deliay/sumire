/**
 * 未缓冲 seek 编排：码率线性估算 → Range 窗口探测 → FLV tag 边界对齐 → patch 续播。
 *
 * FLV demuxer（mpegts.js）无 mid-stream resync 能力，续播起点必须是 FLV 文件头或 tag 边界，
 * 故在调用 patched `seekToByteOffset` 前须先扫描并对齐到可信 tag 边界。
 *
 * 关键约束：续播起点若为**音频 tag**，首个到达的媒体段是 audio，而 mpegts 的
 * LoadingController 在任意 MEDIA_SEGMENT（音频也算）到达时按
 * `buffered_end >= currentTime + lazyLoadMaxDuration` 暂停 transmuxer，而 RECOMMEND_SEEKPOINT
 * 只在 **video** 段到达后才回写 currentTime——若在视频关键帧到达前 IO 被暂停且旧缓冲已被
 * flush，则恢复条件永假、整体冻死。故本模块**优先对齐到视频关键帧 tag**
 * （`tagType=9` 且 `frameType=1`），保证续播后首个媒体段为 video；找不到时回退任意合法
 * tag 边界，并由 patch 层「seek 期间临时关闭 lazyLoad + 立即对齐 currentTime」兜底防死锁。
 */

import { seekToByteOffset as playerSeekToByteOffset } from "@/features/recordings/player";

/** 最小探测窗口：256KB。 */
export const SEEK_WINDOW_BYTES = 262144;
/** 关键帧扫描的字节上限（按码率推算，封顶防止无限下载）。 */
export const MAX_KEYFRAME_SCAN_BYTES = 8 * 1024 * 1024;
/** 关键帧扫描覆盖的时长假设（覆盖常见 GOP；实测录播 GOP 约 8s）。 */
export const KEYFRAME_SCAN_SECONDS = 10;
/** 单次窗口读取的硬上限：即使上游忽略 Range，也绝不读入超过该值。 */
export const MAX_WINDOW_READ_BYTES = MAX_KEYFRAME_SCAN_BYTES;

const FLV_TAG_TYPES = new Set([8, 9, 18]);
const FLV_TAG_HEADER_BYTES = 11;
/** 单个 FLV tag 的可信上限（防止把噪声误判为超大 tag）。 */
const MAX_FLV_TAG_BYTES = 8 * 1024 * 1024;

/** FLV tag 边界。 */
export interface TagBoundary {
  fileposition: number;
  milliseconds: number;
}

/** 播放器续播回调：返回 `false` 表示未真正生效（patch 缺失/结构不符），需显性失败。 */
export type ApplySeek = (fileposition: number, milliseconds: number) => boolean | void;

/**
 * 由文件大小与总时长线性估算目标时间的字节偏移（纯函数）。
 * 非法输入返回 0；结果钳制到 `[0, fileSize - 1]`。
 */
export function estimateByteOffset(targetMs: number, durationMs: number, fileSize: number): number {
  if (!Number.isFinite(targetMs) || !Number.isFinite(durationMs) || !Number.isFinite(fileSize)) return 0;
  if (durationMs <= 0 || fileSize <= 0) return 0;
  const raw = Math.floor((fileSize * Math.max(0, targetMs)) / durationMs);
  return Math.min(Math.max(raw, 0), fileSize - 1);
}

/** 按码率推算关键帧扫描窗口（纯函数）：覆盖 `KEYFRAME_SCAN_SECONDS`，钳制 `[SEEK_WINDOW_BYTES, MAX_KEYFRAME_SCAN_BYTES]`。 */
export function computeScanBytes(bitrateBps: number): number {
  const valid = Number.isFinite(bitrateBps) && bitrateBps > 0 ? bitrateBps : 0;
  const raw = Math.floor((valid / 8) * KEYFRAME_SCAN_SECONDS);
  return Math.min(Math.max(raw, SEEK_WINDOW_BYTES), MAX_KEYFRAME_SCAN_BYTES);
}

function readU24(window: Uint8Array, at: number): number {
  return (window[at] << 16) | (window[at + 1] << 8) | window[at + 2];
}

function readTagMillis(window: Uint8Array, at: number): number {
  return (window[at + 6] | (window[at + 5] << 8) | (window[at + 4] << 16) | (window[at + 7] << 24)) >>> 0;
}

/**
 * 候选 tag 三重校验：`tagType ∈ {8,9,18}`、`dataSize > 0`、
 * `PrevTagSize === 11 + dataSize`。未通过或数据尚不完整时返回 `null`
 * （调用方一律跳过——窗口可随下载增长后重扫）。
 */
function validateTag(window: Uint8Array, at: number): { dataSize: number; nextAt: number } | null {
  const type = window[at];
  if (!FLV_TAG_TYPES.has(type)) return null;
  const dataSize = readU24(window, at + 1);
  if (dataSize <= 0 || dataSize > MAX_FLV_TAG_BYTES) return null;
  const prevTagSizeAt = at + FLV_TAG_HEADER_BYTES + dataSize;
  if (prevTagSizeAt + 4 > window.length) return null;
  const prevTagSize =
    ((window[prevTagSizeAt] << 24) |
      (window[prevTagSizeAt + 1] << 16) |
      (window[prevTagSizeAt + 2] << 8) |
      window[prevTagSizeAt + 3]) >>>
    0;
  if (prevTagSize !== FLV_TAG_HEADER_BYTES + dataSize) return null;
  return { dataSize, nextAt: prevTagSizeAt + 4 };
}

/**
 * 扫描首个任意类型合法 tag 边界（纯函数）。
 * 尚不完整的候选（`PrevTagSize` 不可校验）一律跳过——窗口可随下载增长后重扫，
 * 绝不因一个无法校验的假 tag 阻塞扫描。
 */
export function findNextTagBoundary(window: Uint8Array, baseOffset: number): TagBoundary | null {
  for (let i = 0; i + FLV_TAG_HEADER_BYTES <= window.length; i++) {
    const tag = validateTag(window, i);
    if (!tag) continue;
    return { fileposition: baseOffset + i, milliseconds: readTagMillis(window, i) };
  }
  return null;
}

/** 扫描首个**视频关键帧** tag 边界（`tagType=9` 且 `frameType=1`），纯函数。 */
export function findVideoKeyframeBoundary(window: Uint8Array, baseOffset: number): TagBoundary | null {
  for (let i = 0; i + FLV_TAG_HEADER_BYTES <= window.length; i++) {
    if (window[i] !== 9) continue;
    const tag = validateTag(window, i);
    if (!tag) continue;
    if (window[i + FLV_TAG_HEADER_BYTES] >> 4 !== 1) continue;
    return { fileposition: baseOffset + i, milliseconds: readTagMillis(window, i) };
  }
  return null;
}

/** 取消响应体（避免继续下载）；失败忽略。 */
async function cancelBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // 取消失败忽略
  }
}

/**
 * 有上限地流式读取并扫描窗口：边读边扫（对已收数据整体重扫，规避假 tag 阻塞），
 * 命中视频关键帧即取消剩余下载；无流能力时退回 `arrayBuffer()` 一次性扫描。
 */
async function readAndScanSeekWindow(
  res: Response,
  baseOffset: number,
  cap: number,
): Promise<{ keyframe: TagBoundary | null; fallback: TagBoundary | null } | null> {
  const body = res.body as (ReadableStream<Uint8Array> & { getReader?: unknown }) | null | undefined;
  if (!body || typeof body.getReader !== "function") {
    try {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > cap) return null;
      const view = new Uint8Array(buffer);
      return { keyframe: findVideoKeyframeBoundary(view, baseOffset), fallback: findNextTagBoundary(view, baseOffset) };
    } catch {
      return null;
    }
  }

  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const buffer = new Uint8Array(cap);
  let length = 0;
  let keyframe: TagBoundary | null = null;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      const remaining = cap - length;
      if (value.byteLength >= remaining) {
        buffer.set(value.subarray(0, remaining), length);
        length += remaining;
        await reader.cancel().catch(() => undefined);
        break;
      }
      buffer.set(value, length);
      length += value.byteLength;
      keyframe = findVideoKeyframeBoundary(buffer.subarray(0, length), baseOffset);
      if (keyframe) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  } catch {
    return null;
  }
  const view = buffer.subarray(0, length);
  return {
    keyframe: keyframe ?? findVideoKeyframeBoundary(view, baseOffset),
    fallback: findNextTagBoundary(view, baseOffset),
  };
}

export interface SeekUnbufferedArgs {
  url: string;
  targetSeconds: number;
  durationSeconds: number;
  fileSize: number;
  /** 依赖注入点（默认走 player 单例桥接 patched `seekToByteOffset`）。 */
  seekToByteOffset?: ApplySeek;
}

/** seek 代次：并发 seek 以 last-wins 丢弃过期探测结果，避免过期落点覆盖最新意图。 */
let seekGeneration = 0;

/**
 * 未缓冲 seek 编排：估算 → Range 窗口探测（流式扫描）→ 视频关键帧边界对齐 → 调 `seekToByteOffset`。
 *
 * 仅在拿到 `206 Partial Content` 且窗口读取在上限内时继续；非 206 一律取消响应体并
 * 返回 `false`（避免把整文件读入内存冻死标签页）。优先对齐视频关键帧；无关键帧时回退任意
 * tag 边界。成功返回 true；任何失败路径均记录错误并返回 false，不抛错、不静默冻结。
 */
export async function seekUnbuffered(args: SeekUnbufferedArgs): Promise<boolean> {
  const { url, targetSeconds, durationSeconds, fileSize } = args;
  const applySeek = args.seekToByteOffset ?? playerSeekToByteOffset;
  const generation = ++seekGeneration;

  if (!Number.isFinite(targetSeconds) || !Number.isFinite(durationSeconds)) return false;
  if (durationSeconds <= 0 || fileSize <= 0) return false;

  const targetMs = Math.min(Math.max(targetSeconds, 0), durationSeconds) * 1000;
  const estimated = estimateByteOffset(targetMs, durationSeconds * 1000, fileSize);
  const scanBytes = computeScanBytes((fileSize * 8) / durationSeconds);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Range: `bytes=${estimated}-${estimated + scanBytes - 1}` },
    });
  } catch (error) {
    console.error("[recordings] seek: Range 窗口请求失败", error);
    return false;
  }
  // 过期探测：已有更新的 seek 发起，丢弃本次结果（先取消响应体避免继续下载）
  if (generation !== seekGeneration) {
    await cancelBody(res);
    return false;
  }
  if (res.status !== 206) {
    // 上游未按 Range 返回（如代理不透传 / 返回整文件）：一律取消响应体并降级，绝不整文件 buffer
    console.error(`[recordings] seek: 上游未返回 206（实际 ${res.status}），放弃未缓冲 seek`);
    await cancelBody(res);
    return false;
  }

  // 解析 Content-Range 校正起始偏移（缺失时回退估算值）
  const contentRange = res.headers.get("content-range");
  let baseOffset = estimated;
  if (contentRange) {
    const match = /bytes\s+(\d+)-(\d+)\//.exec(contentRange);
    if (match) {
      baseOffset = Number(match[1]);
      const end = Number(match[2]);
      if (Number.isFinite(end) && end - baseOffset + 1 > MAX_WINDOW_READ_BYTES) {
        console.error("[recordings] seek: Content-Range 超出窗口读取上限，放弃");
        await cancelBody(res);
        return false;
      }
    }
  }
  const contentLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_WINDOW_READ_BYTES) {
    console.error("[recordings] seek: Content-Length 超出窗口读取上限，放弃");
    await cancelBody(res);
    return false;
  }

  const scanResult = await readAndScanSeekWindow(res, baseOffset, scanBytes);
  if (!scanResult) {
    console.error("[recordings] seek: 窗口读取失败或超上限");
    return false;
  }
  if (generation !== seekGeneration) return false;

  const boundary = scanResult.keyframe ?? scanResult.fallback;
  if (boundary) {
    if (!scanResult.keyframe) {
      console.warn("[recordings] seek: 窗口内未找到视频关键帧，回退任意 tag 边界（依赖 patch 防死锁兜底）");
    }
    try {
      const applied = applySeek(boundary.fileposition, boundary.milliseconds);
      if (applied === false) {
        console.error("[recordings] seek: patched seekToByteOffset 未生效（补丁缺失或结构不符）");
        return false;
      }
      return true;
    } catch (error) {
      console.error("[recordings] seek: patched seekToByteOffset 调用异常", error);
      return false;
    }
  }

  // 扫描失败：降级为从估算偏移直接尝试（可能 demux 失败，由既有错误提示兜底）
  console.error("[recordings] seek: 窗口内未找到可信 tag 边界，降级为估算偏移直试");
  try {
    const applied = applySeek(estimated, targetMs);
    if (applied === false) return false;
  } catch (error) {
    console.error("[recordings] seek: 降级直试异常", error);
    return false;
  }
  return false;
}
