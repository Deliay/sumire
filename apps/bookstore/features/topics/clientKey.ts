const STORAGE_KEY = "topics.clientKey";

export function getClientKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && /^[0-9a-f-]{36}$/.test(stored)) return stored;
    const key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
    return key;
  } catch {
    const key = crypto.randomUUID();
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
    return key;
  }
}
