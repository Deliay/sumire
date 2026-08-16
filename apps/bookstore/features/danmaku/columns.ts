import { z } from "zod";
import { ColumnConfigSchema, type ColumnConfig } from "./types";

/**
 * 栏位配置持久化：localStorage（key `danmaku-backdoor.columns`），布局属个人偏好。
 * 读取时 Zod 校验，存储损坏/非法一律回退默认 3 栏（提案 K7）。
 */

export const COLUMNS_STORAGE_KEY = "danmaku-backdoor.columns";

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "danmaku", types: ["danmaku"] },
  { id: "super_chat", types: ["super_chat"] },
  { id: "gift_guard", types: ["gift", "guard_buy"] },
];

const ColumnsSchema = z.array(ColumnConfigSchema).min(1);

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取栏位配置；无存储或内容非法时回退默认 3 栏。 */
export function loadColumns(): ColumnConfig[] {
  const storage = getStorage();
  if (!storage) return DEFAULT_COLUMNS;
  const raw = storage.getItem(COLUMNS_STORAGE_KEY);
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed = ColumnsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

/** 写入栏位配置（非法配置直接拒绝，不覆盖既有值）。 */
export function saveColumns(columns: ColumnConfig[]): void {
  const storage = getStorage();
  if (!storage) return;
  const parsed = ColumnsSchema.safeParse(columns);
  if (!parsed.success) return;
  storage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(parsed.data));
}
