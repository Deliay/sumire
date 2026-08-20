"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** 贴顶判定阈值（px）：scrollTop 不超过它视为贴顶，新事件到达保持跟随。 */
export const ANCHOR_THRESHOLD = 8;
/** 「回到顶部」悬浮按钮显示阈值（px）。 */
export const BACK_TO_TOP_THRESHOLD = 200;

/**
 * prepend 锚定补偿计算（纯函数）：
 * 离开顶部（scrollTop > 阈值）且容器变高时，返回补偿后的 scrollTop（旧值 + scrollHeight 差），
 * 保证可视内容不跳；贴顶或容器未变高时返回 null（无需调整，贴顶保持跟随最新）。
 */
export function computeAnchorScrollTop(
  scrollTop: number,
  prevScrollHeight: number,
  nextScrollHeight: number,
  threshold: number = ANCHOR_THRESHOLD,
): number | null {
  if (scrollTop <= threshold) return null;
  const diff = nextScrollHeight - prevScrollHeight;
  if (diff <= 0) return null;
  return scrollTop + diff;
}

interface AnchoredFeed {
  containerRef: RefObject<HTMLDivElement | null>;
  showBackToTop: boolean;
  /** 是否贴顶（scrollTop ≤ 阈值）：贴顶时行平移过渡可见；离顶时 prepend 由锚定补偿瞬时保持内容，
   * 过渡会与补偿叠加造成闪回，须禁用。 */
  isAtTop: boolean;
  handleScroll: () => void;
  scrollToTop: () => void;
}

/**
 * 倒序信息流滚动锚定（提案 K4）：新事件 prepend 到顶部导致 scrollHeight 增长后，
 * 若用户已离开顶部则按 scrollHeight 差补偿 scrollTop；scrollTop > 200 显示「回到顶部」。
 * 虚拟化实测回填修正：prepend 的新行无测量缓存，先按 estimateSize 计入总高并据此补偿（计入挂账）；
 * 之后新行实测回填使总高回缩时，在挂账额度内回退多补部分。无挂账的回缩（如下滚动实测偏小）不调整。
 */
export function useAnchoredFeed(): AnchoredFeed {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef(0);
  // 补偿挂账（px）：prepend 的新行无测量缓存，先按 estimateSize 计入总高并据此补偿；
  // 待新行实测回填、总高回缩时从挂账回退多补部分（净补偿=新行实测高度）。
  // 用挂账而非布尔标记：补偿本身触发 isScrolling 等中间渲染（diff=0），布尔会被误清。
  const correctionDebtRef = useRef(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isAtTop, setIsAtTop] = useState(true);

  // 每次渲染后记录 scrollHeight 基线；高度增长（新事件 prepend 到顶部）且离开顶部时补偿。
  // 无依赖数组：补偿基于「相邻两次渲染的高度差」，高度未变时 diff=0 天然幂等。
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prev = prevHeightRef.current;
    const next = el.scrollHeight;
    if (prev > 0) {
      const scrollTop = el.scrollTop;
      const diff = next - prev;
      if (diff > 0) {
        const adjusted = computeAnchorScrollTop(scrollTop, prev, next);
        if (adjusted !== null) {
          el.scrollTop = adjusted;
          correctionDebtRef.current += diff;
        } else {
          correctionDebtRef.current = 0;
        }
      } else if (diff < 0 && correctionDebtRef.current > 0 && scrollTop > ANCHOR_THRESHOLD) {
        // 实测回填回缩：在挂账额度内回退多补的部分（无挂账的回缩不调整，防滚动中视口跳动）
        const payback = Math.min(-diff, correctionDebtRef.current);
        el.scrollTop = scrollTop - payback;
        correctionDebtRef.current -= payback;
      }
    }
    prevHeightRef.current = next;
  });

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    setShowBackToTop(el ? el.scrollTop > BACK_TO_TOP_THRESHOLD : false);
    setIsAtTop(el ? el.scrollTop <= ANCHOR_THRESHOLD : true);
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, []);

  return { containerRef, showBackToTop, isAtTop, handleScroll, scrollToTop };
}
