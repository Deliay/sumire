import type { DefaultScheme, WeekScheme } from "./scheme";
import { DefaultSchemeSchema, WeekSchemeSchema, createDefaultScheme } from "./scheme";
import type { ISOWeek } from "./weekUtils";
import { z } from "zod";

const DEFAULT_KEY = "weekly-image.default";

export function weekKey(year: number, week: number): string {
  return `weekly-image.week.${year}-${week}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

const memoryMap = new Map<string, DefaultScheme | WeekScheme>();

// For testing: clear memory cache
export function clearMemoryCache(): void {
  memoryMap.clear();
}

function loadFromStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  const storage = getStorage();
  let raw: string | null = null;
  
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    // localStorage not available, use memory fallback
  }

  if (raw === null) {
    return memoryMap.get(key) as T | null ?? null;
  }

  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
  } catch {
    // corrupted JSON
  }

  return null;
}

function saveToStorage<T extends DefaultScheme | WeekScheme>(key: string, value: T): void {
  const storage = getStorage();
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage not available, use memory fallback
  }
  memoryMap.set(key, value);
}

function deleteFromStorage(key: string): void {
  const storage = getStorage();
  try {
    storage?.removeItem(key);
  } catch {
    // localStorage not available
  }
  memoryMap.delete(key);
}

function hasInStorage(key: string): boolean {
  const storage = getStorage();
  try {
    if (storage?.getItem(key) !== null) return true;
  } catch {
    // localStorage not available
  }
  return memoryMap.has(key);
}

export function loadDefault(): DefaultScheme {
  const scheme = loadFromStorage(DEFAULT_KEY, DefaultSchemeSchema);
  return scheme ?? createDefaultScheme();
}

export function saveDefault(scheme: DefaultScheme): void {
  saveToStorage(DEFAULT_KEY, scheme);
}

export function loadWeek(week: ISOWeek): WeekScheme | null {
  const key = weekKey(week.year, week.week);
  return loadFromStorage(key, WeekSchemeSchema);
}

export function saveWeek(scheme: WeekScheme): void {
  const key = weekKey(scheme.week.year, scheme.week.week);
  saveToStorage(key, scheme);
}

export function deleteWeek(week: ISOWeek): void {
  const key = weekKey(week.year, week.week);
  deleteFromStorage(key);
}

export function hasWeek(week: ISOWeek): boolean {
  const key = weekKey(week.year, week.week);
  return hasInStorage(key);
}