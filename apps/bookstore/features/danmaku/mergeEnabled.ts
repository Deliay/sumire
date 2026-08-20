/**
 * 弹幕合并开关持久化：localStorage `danmaku-backdoor.merge-danmaku`（JSON boolean）。
 * 读取时类型校验，损坏/非法回退 false（默认关闭）。无需 useSyncExternalStore——
 * 开关仅看板单组件持有，不跨组件同步（口径仿 giftMinPrice.ts）。
 */

export const MERGE_ENABLED_STORAGE_KEY = "danmaku-backdoor.merge-danmaku";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取弹幕合并开关；无存储或内容非法时回退 false。 */
export function loadMergeEnabled(): boolean {
  const raw = getStorage()?.getItem(MERGE_ENABLED_STORAGE_KEY) ?? null;
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "boolean" ? parsed : false;
  } catch {
    return false;
  }
}

/** 写入弹幕合并开关（JSON boolean）。 */
export function saveMergeEnabled(v: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify(v));
}
