import { z } from "zod";
import { ColumnConfigSchema, type ColumnConfig } from "./types";

/**
 * 栏位配置持久化：localStorage（key `danmaku-backdoor.columns`），布局属个人偏好。
 * 读取时 Zod 校验，存储损坏/非法一律回退默认 3 栏（提案 K7）。
 * 提供 useSyncExternalStore 快照口径（缓存保证引用稳定，跨标签页经 storage 事件同步）。
 */

export const COLUMNS_STORAGE_KEY = "danmaku-backdoor.columns";

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "gift_guard", types: ["gift", "guard_buy"] },
  { id: "super_chat", types: ["super_chat"] },
  { id: "danmaku", types: ["danmaku"] },
];

/** 栏数预设：视图栏选择器按栏数切换的默认类型分布（PRD F10）。 */
export const COLUMN_PRESETS: Readonly<Record<1 | 2 | 3, ColumnConfig[]>> = {
  1: [{ id: "all", types: ["danmaku", "super_chat", "gift", "guard_buy"] }],
  2: [
    { id: "sc_guard", types: ["guard_buy", "super_chat"] },
    { id: "gift_danmaku", types: ["gift", "danmaku"] },
  ],
  3: DEFAULT_COLUMNS,
};

/** 视口档位：narrow(<640) / medium(640-1023) / wide(>=1024)。 */
export type ViewportTier = "narrow" | "medium" | "wide";

/**
 * 视口自适应栏位：把已存栏位配置夹取到当前视口允许的栏数（纯视图层，不写回存储）。
 * 界内原样保留（不丢用户自定义类型分布）；越界用对应预设覆盖——narrow 恒单栏全类型、
 * medium 超出 2 栏折叠为单栏、wide 单栏升为 2 栏。
 */
export function resolveColumns(columns: ColumnConfig[], tier: ViewportTier): ColumnConfig[] {
  switch (tier) {
    case "narrow":
      return columns.length === 1 ? columns : COLUMN_PRESETS[1];
    case "medium":
      return columns.length <= 2 ? columns : COLUMN_PRESETS[1];
    case "wide":
      return columns.length >= 2 ? columns : COLUMN_PRESETS[2];
  }
}

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
