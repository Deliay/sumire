/** 录播页展示格式化工具。 */

/** 字节数转人性化单位（1 KB = 1024 B，保留一位小数）。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return `${bytes} B`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return index === 0 ? `${value} B` : `${value.toFixed(1)} ${units[index]}`;
}

/** ISO 时间转本地「YYYY/MM/DD HH:mm」。 */
export function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
