/**
 * 未缓冲 seek 编排：码率线性估算 → Range 窗口探测 → FLV tag 边界对齐 → patch 续播。
 *
 * FLV demuxer（mpegts.js）无 mid-stream resync 能力，续播起点必须是 FLV 文件头或 tag 边界，
 * 故在调用 patched `seekToByteOffset` 前须先扫描并对齐到可信 tag 边界。
 */

import { seekToByteOffset as playerSeekToByteOffset } from "@/features/recordings/player";

/** 探测窗口大小：256KB（远大于单个 FLV tag，窗口内必有 tag 边界）。 */
export const SEEK_WINDOW_BYTES = 262144;

/** 单次窗口读取的硬上限：即使上游忽略 Range 返回整文件，也绝不读入超过该值。 */
export const MAX_WINDOW_READ_BYTES = SEEK_WINDOW_BYTES * 2;

const FLV_TAG_TYPES = new Set([8, 9, 18]);
const FLV_TAG_HEADER_BYTES = 11;

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

/** 取消响应体（避免继续下载）；失败忽略。 */
async function cancelBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // 取消失败忽略
  }
}

/**
 * 有上限地读取响应体：优先流式累计，超出上限立即取消并返回 null；
 * 无流能力时退回 `arrayBuffer()` 并同样校验上限。
 */
async function readCappedBody(res: Response, cap: number): Promise<Uint8Array | null> {
  const body = res.body as (ReadableStream<Uint8Array> & { getReader?: unknown }) | null | undefined;
  if (body && typeof body.getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > cap) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        chunks.push(value);
      }
    } catch {
      return null;
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.byteLength;
    }
    return out;
  }
  try {
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > cap) return null;
    return new Uint8Array(buffer);
  } catch {
    return null;
  }
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
 * 未缓冲 seek 编排：估算 → Range 窗口探测 → 边界对齐 → 调 `seekToByteOffset`。
 *
 * 仅在拿到 `206 Partial Content` 且窗口读取在上限内时继续；非 206 一律取消响应体并
 * 返回 `false`（避免把整文件读入内存冻死标签页）。成功返回 true；任何失败路径均记录
 * 错误并返回 false，不抛错、不静默冻结。
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

  const window = await readCappedBody(res, MAX_WINDOW_READ_BYTES);
  if (!window) {
    console.error("[recordings] seek: 窗口读取失败或超上限");
    return false;
  }
  if (generation !== seekGeneration) return false;

  const boundary = findNextTagBoundary(window, baseOffset);
  if (boundary) {
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
