/**
 * 录播回放时间窗口纯函数。
 *
 * 时间锚点取文件 `info.startedAt`（场次实际开始），**不是** `createdAt`——
 * 实测 `createdAt` 是文件落盘（≈分段结束）时刻；同场次多分段文件共享同一
 * `recordingId`/`info.startedAt`/`info.endedAt`，各分段实际覆盖区间需按
 * `createdAt` 升序推导（见 `segmentBoundsForFile`）。窗口以分段起点为原点按
 * 10min 对齐切分，把事件墙上时钟映射为相对录播偏移。
 */

import type { RecordingFile } from "@/features/recordings/api";

/** 单窗口时长（10 分钟）。 */
export const WINDOW_MS = 600_000;
/** replay 端点单次请求上界（12 小时），duration 未知时以它为窗口上界。 */
export const MAX_RANGE_MS = 12 * 60 * 60 * 1000;

/** 事件相对录播起点的偏移（毫秒）。 */
export function offsetMs(occurredAt: string, recordStart: string): number {
  return Date.parse(occurredAt) - Date.parse(recordStart);
}

/** 偏移毫秒 → 窗口序号（负值钳制到 0）。 */
export function windowIndexForOffset(offset: number): number {
  if (!Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset / WINDOW_MS);
}

/**
 * 计算窗口的绝对时间边界：
 * - 起点 `recordStartMs + index * WINDOW_MS`；
 * - 终点 `min(起点 + WINDOW_MS, recordEnd)`；`recordEnd` 未知时以 `recordStart + 12h` 为上界；
 * - recordEnd 落在窗口起点之前时终点钳制到 recordEnd（该窗口为空窗，调用方应跳过）。
 */
export function windowBounds(
  index: number,
  recordStartMs: number,
  recordEndMs?: number | null,
): { startMs: number; endMs: number } {
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.floor(index) : 0;
  const startMs = recordStartMs + safeIndex * WINDOW_MS;
  const hasEnd = recordEndMs != null && Number.isFinite(recordEndMs) && recordEndMs > recordStartMs;
  const upper = hasEnd ? (recordEndMs as number) : recordStartMs + MAX_RANGE_MS;
  const endMs = Math.min(startMs + WINDOW_MS, upper);
  return { startMs, endMs };
}

/** 绝对毫秒 → ISO 字符串（供 replay 端点查询参数使用）。 */
export function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** 目标录播分段实际覆盖的时间区间（毫秒）；无法确定时为 null。 */
export interface SegmentBounds {
  startMs: number | null;
  endMs: number | null;
  /** true 表示 info 缺失、回退到 `createdAt` 口径（近似，误差为整场时长）。 */
  fallback: boolean;
}

function parseMs(value: string | undefined | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 推导目标文件（分段）实际覆盖的时间区间。
 *
 * 录播服务每个文件带 `info`（`recordingId`/`title`/`mid`/`startedAt`/`endedAt`），
 * 同场次多分段共享同一 `recordingId` 与 `startedAt`/`endedAt`：
 * - 无同 recordingId 兄弟（单段）：`start = info.startedAt`，`end = info.endedAt`；
 * - 多段（按 `createdAt` 升序）：首段 `start = info.startedAt`，其后各段 `start = 前一段 createdAt`；
 *   非末段 `end = 本段 createdAt`（与下一段起点衔接），末段 `end = info.endedAt`（缺失则用本段 createdAt）；
 * - `info.startedAt` 缺失：回退 `createdAt` 为起点（`fallback=true`）；此时若终点不晚于起点，
 *   终点置 null 交由 duration 推算兜底。
 */
export function segmentBoundsForFile(files: RecordingFile[], target: RecordingFile): SegmentBounds {
  const targetCreated = parseMs(target.createdAt);
  const infoStart = parseMs(target.info?.startedAt);
  const infoEnd = parseMs(target.info?.endedAt);
  const recordingId = target.info?.recordingId;
  const fallback = infoStart === null;
  const sessionStart = infoStart ?? targetCreated;

  const siblings = recordingId
    ? files
        .filter((file) => file.info?.recordingId === recordingId)
        .slice()
        .sort((a, b) => (parseMs(a.createdAt) ?? Number.POSITIVE_INFINITY) - (parseMs(b.createdAt) ?? Number.POSITIVE_INFINITY))
    : [];
  const index = siblings.findIndex((file) => file.name === target.name);
  const isLast = index === -1 || index === siblings.length - 1;

  let startMs = sessionStart;
  if (index > 0) {
    startMs = parseMs(siblings[index - 1]?.createdAt) ?? sessionStart;
  }
  let endMs: number | null = isLast ? (infoEnd ?? targetCreated) : targetCreated;
  // 终点不晚于起点（info 缺失回退 / 异常数据）时交由 duration 兜底
  if (startMs !== null && endMs !== null && endMs <= startMs) endMs = null;

  return { startMs, endMs, fallback };
}
