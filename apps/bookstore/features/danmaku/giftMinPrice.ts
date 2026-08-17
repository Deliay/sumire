import { z } from "zod";

/**
 * 礼物最低金额筛选持久化：localStorage `danmaku-backdoor.gift-min-price`（JSON number）。
 * 读取时 Zod 校验，损坏/非法回退 0（不筛选）。无需 useSyncExternalStore——
 * 阈值仅看板单组件持有，不跨组件同步。
 */

export const MIN_PRICE_STORAGE_KEY = "danmaku-backdoor.gift-min-price";

const MinPriceSchema = z.coerce.number().finite();

/** 夹取 minPrice 到 [0, 100]，四舍五入到 0.1 步进，非法回退 0。 */
export function clampMinPrice(v: unknown): number {
  const parsed = MinPriceSchema.safeParse(v);
  if (!parsed.success) return 0;
  const clamped = Math.round(parsed.data * 10) / 10;
  return Math.max(0, Math.min(100, clamped));
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取礼物最低金额；无存储或内容非法时回退 0。 */
export function loadGiftMinPrice(): number {
  const raw = getStorage()?.getItem(MIN_PRICE_STORAGE_KEY) ?? null;
  if (!raw) return 0;
  try {
    return clampMinPrice(JSON.parse(raw));
  } catch {
    return 0;
  }
}

/** 写入礼物最低金额（夹取后写 JSON number）。 */
export function saveGiftMinPrice(v: number): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(MIN_PRICE_STORAGE_KEY, JSON.stringify(clampMinPrice(v)));
}
