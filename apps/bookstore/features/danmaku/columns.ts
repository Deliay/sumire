import { z } from "zod";
import { ColumnConfigSchema, type ColumnConfig } from "./types";

/**
 * 栏位配置持久化：localStorage（key `danmaku-backdoor.columns`），布局属个人偏好。
 * 读取时 Zod 校验，存储损坏/非法一律回退默认 3 栏（提案 K7）。
 * 提供 useSyncExternalStore 快照口径（缓存保证引用稳定，跨标签页经 storage 事件同步）。
 */

export const COLUMNS_STORAGE_KEY = "danmaku-backdoor.columns";

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "danmaku_gift", types: ["danmaku", "gift"] },
  { id: "super_chat", types: ["super_chat"] },
  { id: "guard_buy", types: ["guard_buy"] },
];

const ColumnsSchema = z.array(ColumnConfigSchema).min(1);

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function parseColumns(raw: string | null): ColumnConfig[] {
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed = ColumnsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

/** 读取栏位配置；无存储或内容非法时回退默认 3 栏。 */
export function loadColumns(): ColumnConfig[] {
  return parseColumns(getStorage()?.getItem(COLUMNS_STORAGE_KEY) ?? null);
}

const listeners = new Set<() => void>();

/** 写入栏位配置（非法配置直接拒绝，不覆盖既有值），并通知订阅者。 */
export function saveColumns(columns: ColumnConfig[]): void {
  const storage = getStorage();
  if (!storage) return;
  const parsed = ColumnsSchema.safeParse(columns);
  if (!parsed.success) return;
  storage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(parsed.data));
  for (const listener of listeners) listener();
}

// useSyncExternalStore 快照缓存：raw 未变时返回同一引用，避免无限重渲染
let cachedRaw: string | null | undefined;
let cachedColumns: ColumnConfig[] = DEFAULT_COLUMNS;

export function getColumnsSnapshot(): ColumnConfig[] {
  const raw = getStorage()?.getItem(COLUMNS_STORAGE_KEY) ?? null;
  if (raw === cachedRaw) return cachedColumns;
  cachedRaw = raw;
  cachedColumns = parseColumns(raw);
  return cachedColumns;
}

export function getColumnsServerSnapshot(): ColumnConfig[] {
  return DEFAULT_COLUMNS;
}

export function subscribeColumns(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLUMNS_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
