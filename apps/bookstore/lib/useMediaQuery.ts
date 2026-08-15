import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * 断点判定 hook：用 useSyncExternalStore 封装 matchMedia，订阅 change 事件。
 * getServerSnapshot 固定 false（SSR/首帧恒为桌面月视图，客户端首帧后按真实视口切换）。
 * 无 matchMedia 环境（极老浏览器）兜底 false。
 */
export function useMediaQuery(query: string): boolean {
  const mql = useMemo(() => {
    if (typeof window === "undefined") return null;
    const mm = window.matchMedia;
    if (typeof mm !== "function") return null;
    return mm(query);
  }, [query]);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!mql) return () => {};
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [mql],
  );

  const getSnapshot = useCallback(() => (mql ? mql.matches : false), [mql]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
