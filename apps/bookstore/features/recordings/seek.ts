/**
 * 未缓冲 seek 编排：码率线性估算 → Range 窗口探测 → FLV tag 边界对齐 → patch 续播。
 *
 * FLV demuxer（mpegts.js）无 mid-stream resync 能力，续播起点必须是 FLV 文件头或 tag 边界，
 * 故在调用 patched `seekToByteOffset` 前须先扫描并对齐到可信 tag 边界。
 */

import { seekToByteOffset as playerSeekToByteOffset } from "@/features/recordings/player";

/** 探测窗口大小：256KB（远大于单个 FLV tag，窗口内必有 tag 边界）。 */
export const SEEK_WINDOW_BYTES = 262144;

const FLV_TAG_TYPES = new Set([8, 9, 18]);
const FLV_TAG_HEADER_BYTES = 11;

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

/**
 * 在字节窗口内扫描首个可信 FLV tag 边界（纯函数）。
 *
 * 候选条件：`tagType ∈ {8,9,18}`、`dataSize > 0`、tag 末尾 `PrevTagSize === 11 + dataSize`
 * 且紧邻下一字节仍为合法 `tagType`（窗口不足时放宽为单重校验）。
 * 扫描优先返回通过完整校验的候选；若仅有尾部截断候选，则退而返回该候选。
 */
export function findNextTagBoundary(
  window: Uint8Array,
  baseOffset: number,
): { fileposition: number; milliseconds: number } | null {
  let truncated: { fileposition: number; milliseconds: number } | null = null;

  for (let i = 0; i + FLV_TAG_HEADER_BYTES <= window.length; i++) {
    if (!FLV_TAG_TYPES.has(window[i])) continue;
    const dataSize = (window[i + 1] << 16) | (window[i + 2] << 8) | window[i + 3];
    if (dataSize <= 0) continue;

    const milliseconds =
      (window[i + 6] | (window[i + 5] << 8) | (window[i + 4] << 16) | (window[i + 7] << 24)) >>> 0;

    const prevTagSizeAt = i + FLV_TAG_HEADER_BYTES + dataSize;
    if (prevTagSizeAt + 4 > window.length) {
      // 窗口尾部截断：不足以校验 PrevTagSize，先记为放宽候选
      truncated ??= { fileposition: baseOffset + i, milliseconds };
      continue;
    }

    const prevTagSize =
      ((window[prevTagSizeAt] << 24) |
        (window[prevTagSizeAt + 1] << 16) |
        (window[prevTagSizeAt + 2] << 8) |
        window[prevTagSizeAt + 3]) >>>
      0;
    if (prevTagSize !== FLV_TAG_HEADER_BYTES + dataSize) continue;

    const nextTagAt = prevTagSizeAt + 4;
    if (nextTagAt + 1 <= window.length && !FLV_TAG_TYPES.has(window[nextTagAt])) continue;

    return { fileposition: baseOffset + i, milliseconds };
  }

  return truncated;
}

export interface SeekUnbufferedArgs {
  url: string;
  targetSeconds: number;
  durationSeconds: number;
  fileSize: number;
  /** 依赖注入点（默认走 player 单例桥接 patched `seekToByteOffset`）。 */
  seekToByteOffset?: (fileposition: number, milliseconds: number) => void;
}

/** seek 代次：并发 seek 以 last-wins 丢弃过期探测结果，避免过期落点覆盖最新意图。 */
let seekGeneration = 0;

/**
 * 未缓冲 seek 编排：估算 → Range 窗口探测 → 边界对齐 → 调 `seekToByteOffset`。
 * 成功返回 true；fetch 失败或扫描失败（降级直试）返回 false，不抛错。
 */
export async function seekUnbuffered(args: SeekUnbufferedArgs): Promise<boolean> {
  const { url, targetSeconds, durationSeconds, fileSize } = args;
  const applySeek = args.seekToByteOffset ?? playerSeekToByteOffset;
  const generation = ++seekGeneration;

  if (!Number.isFinite(targetSeconds) || !Number.isFinite(durationSeconds)) return false;
  if (durationSeconds <= 0 || fileSize <= 0) return false;

  const targetMs = Math.min(Math.max(targetSeconds, 0), durationSeconds) * 1000;
  const estimated = estimateByteOffset(targetMs, durationSeconds * 1000, fileSize);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Range: `bytes=${estimated}-${estimated + SEEK_WINDOW_BYTES - 1}` },
    });
  } catch {
    return false;
  }
  // 过期探测：已有更新的 seek 发起，丢弃本次结果
  if (generation !== seekGeneration) return false;
  if (!res.ok && res.status !== 206) return false;

  let window: Uint8Array;
  try {
    window = new Uint8Array(await res.arrayBuffer());
  } catch {
    return false;
  }
  if (generation !== seekGeneration) return false;

  // 206 表示服务端按 Range 返回；解析 Content-Range 校正起始偏移（否则回退估算值/整文件从 0 起）
  let baseOffset = estimated;
  if (res.status !== 206) {
    baseOffset = 0;
  } else {
    const contentRange = res.headers.get("content-range");
    const match = contentRange ? /bytes\s+(\d+)-/.exec(contentRange) : null;
    if (match) baseOffset = Number(match[1]);
  }

  const boundary = findNextTagBoundary(window, baseOffset);
  if (boundary) {
    try {
      applySeek(boundary.fileposition, boundary.milliseconds);
    } catch {
      return false;
    }
    return true;
  }

  // 扫描失败：降级为从估算偏移直接尝试（可能 demux 失败，由既有错误提示兜底）
  try {
    applySeek(estimated, targetMs);
  } catch {
    return false;
  }
  return false;
}
