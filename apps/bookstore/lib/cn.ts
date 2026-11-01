/** 极简类名合并（零依赖）：过滤假值、拼接字符串。 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
