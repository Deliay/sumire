/** 二维码下载文件名 sanitize：trim → 文件系统非法字符替换为 `-` → 连续空白折叠为单个空格 → 空回退「未命名主题」。 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
  return cleaned === "" ? "未命名主题" : cleaned;
}