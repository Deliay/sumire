/**
 * 录播回放时间窗口纯函数：以录播文件 `createdAt`（≈ 录制开始）为原点，
 * 按 10min 对齐切窗，把事件墙上时钟映射为相对录播偏移。
 */

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
