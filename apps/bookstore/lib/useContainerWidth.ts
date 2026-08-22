import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 测量容器元素的可用宽度（offsetWidth）。
 * 挂载时读取一次，窗口 resize 时重新读取。
 * SSR/首帧或 jsdom 无布局时返回 undefined（offsetWidth=0 视为未测量）。
 */
export function useContainerWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number | undefined] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    if (ref.current) {
      const w = ref.current.offsetWidth;
      // offsetWidth=0 表示未测量（jsdom 无布局或元素未挂载），保持 undefined
      setWidth(w > 0 ? w : undefined);
    }
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return [ref, width];
}
