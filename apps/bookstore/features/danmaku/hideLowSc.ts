/**
 * 隐藏钢镚开关持久化：localStorage `danmaku-backdoor.hide-low-sc`（JSON boolean）。
 * 读取时类型校验，损坏/非法回退 false（默认关闭）。
 * 复用 columns.ts 的 store + useSyncExternalStore 口径（跨组件同步：页头按钮组 + 看板过滤）。
 */

export const HIDE_LOW_SC_STORAGE_KEY = "danmaku-backdoor.hide-low-sc";

/** SC 是否应因「隐藏钢镚」隐藏：缺金额按未知处理（不隐藏），price < 30 隐藏，>= 30 显示。 */
export function isScHidden(price: number | undefined): boolean {
  return price !== undefined && price < 30;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取隐藏钢镚开关；无存储或内容非法时回退 false。 */
export function loadHideLowSc(): boolean {
  const raw = getStorage()?.getItem(HIDE_LOW_SC_STORAGE_KEY) ?? null;
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : false;
  } catch {
    return false;
  }
}

/** 写入隐藏钢镚开关（JSON boolean），并通知订阅者。 */
export function saveHideLowSc(v: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(HIDE_LOW_SC_STORAGE_KEY, JSON.stringify(v));
  for (const listener of listeners) listener();
}

// useSyncExternalStore 快照缓存：raw 未变时返回同一引用，避免无限重渲染
let cachedRaw: string | null | undefined;
let cachedValue: boolean = false;

export function getHideLowScSnapshot(): boolean {
  const raw = getStorage()?.getItem(HIDE_LOW_SC_STORAGE_KEY) ?? null;
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = loadHideLowSc();
  return cachedValue;
}

export function getHideLowScServerSnapshot(): boolean {
  return false;
}

const listeners = new Set<() => void>();

export function subscribeHideLowSc(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HIDE_LOW_SC_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}
