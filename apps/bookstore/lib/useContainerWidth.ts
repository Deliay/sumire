import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 测量元素的可用宽度（offsetWidth）。
 * - `"self"`（默认）：测量元素自身（挂载后读取一次，resize 时重新读取）。
 * - `"parent"`：测量 `element.parentElement`（适用于组件需感知父容器可用空间的场景）。
 *
 * SSR / 首帧 / jsdom 无布局时返回 undefined（offsetWidth=0 视为未测量）。
 */
export function useContainerWidth<T extends HTMLElement>(
  target: "self" | "parent" = "self",
): [React.RefObject<T | null>, number | undefined] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const measured = target === "parent" ? el.parentElement?.offsetWidth : el.offsetWidth;
    // offsetWidth=0 表示未测量（jsdom 无布局或元素未挂载），保持 undefined
    setWidth(measured && measured > 0 ? measured : undefined);
  }, [target]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return [ref, width];
}
