/**
 * 弹幕合并开关持久化：localStorage `danmaku-backdoor.merge-danmaku`（JSON boolean）。
 * 读取时严格校验 boolean true，损坏/非法回退 false（不合并）。
 */

export const MERGE_ENABLED_STORAGE_KEY = "danmaku-backdoor.merge-danmaku";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取弹幕合并开关；无存储或内容非法时回退 false（不合并）。 */
export function loadMergeEnabled(): boolean {
  const raw = getStorage()?.getItem(MERGE_ENABLED_STORAGE_KEY) ?? null;
  if (raw === null) return false;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "boolean" && parsed === true;
  } catch {
    return false;
  }
}

/** 写入弹幕合并开关。 */
export function saveMergeEnabled(v: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(MERGE_ENABLED_STORAGE_KEY, JSON.stringify(!!v));
}
