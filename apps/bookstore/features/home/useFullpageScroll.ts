"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  createGestureState,
  feedTouch,
  feedWheel,
  nextIndex,
  type GestureState,
} from "@/features/home/fullpage";
import type { SectionDef, SectionChangeDetail, NavigateDetail } from "@/features/home/sections";
import { SECTION_CHANGE_EVENT, NAVIGATE_EVENT } from "@/features/home/sections";

/** 翻页转场时长（ms）。 */
const TRANSITION_MS = 800;
/** reduced-motion 下的淡切转场时长（ms）。 */
const TRANSITION_REDUCED_MS = 200;
/** free 模式回收为 deck 的死区（px）。 */
const BOUNDARY_DEADZONE = 2;
/** 冲量事件名。 */
export const IMPULSE_EVENT = "sumire:flow-impulse";
/** free 模式滚动速度冲量事件名（连续喂入）。 */
export const SCROLL_IMPULSE_EVENT = "sumire:flow-scroll";

export interface FullpageScrollConfig {
  /** 可见站序列（已按 API_CONFIGURED 过滤）。 */
  sections: SectionDef[];
  /** 素材站索引（最后一个站），未配置素材时可为 -1。 */
  assetsIndex: number;
  /** 轨道 DOM ref，由其写入 transform。 */
  trackRef: React.RefObject<HTMLElement | null>;
  /** 容器 DOM ref（free 模式切换 overflow）。 */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 站索引变化回调（用于 SectionRail 高亮与 hash 同步）。 */
  onIndexChange?: (index: number) => void;
}

/** 翻页意图：-1 下一站，+1 上一站。 */
export type TurnIntent = -1 | 1;

/** 事件载荷：翻页方向（供粒子冲量消费）。 */
export interface ImpulseDetail {
  direction: TurnIntent;
}

/** 弹层打开时屏蔽翻页输入（Lightbox/当日详情），由调用方控制。 */
export function useFullpageScroll({
  sections,
  assetsIndex,
  trackRef,
  containerRef,
  onIndexChange,
}: FullpageScrollConfig) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [index, setIndexState] = useState(0);
  const [free, setFree] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const indexRef = useRef(0);
  const freeRef = useRef(false);
  const blockedRef = useRef(false);
  const gestureRef = useRef<GestureState>(createGestureState());
  const touchStartRef = useRef<{ y: number; timestamp: number } | null>(null);
  const lastImpulseTimeRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const lastScrollTimeRef = useRef(0);
  const lastDirectionRef = useRef<TurnIntent>(-1);
  const isFirstRenderRef = useRef(true);
  // sections 引用不稳定（每次渲染新数组），用 ref 稳定供 effect 读取
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const transitionMs = reduce ? TRANSITION_REDUCED_MS : TRANSITION_MS;

  const applyTransform = useCallback(
    (i: number, animated: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      if (reduce) {
        // reduced-motion：transform 瞬时切位，opacity 短促淡切（≤200ms）
        track.style.transition = "none";
        track.style.transform = `translate3d(0, ${-i * 100}svh, 0)`;
        if (animated) {
          // 先清 opacity 过渡瞬时置底，再 rAF 复位触发淡入
          track.style.opacity = "0";
          requestAnimationFrame(() => {
            if (!track) return;
            track.style.transition = `opacity ${TRANSITION_REDUCED_MS}ms ease`;
            track.style.opacity = "1";
          });
        }
        return;
      }
      // 方向感知转场：下翻（下一站）呈「下坠」缓入（起始略慢、加速下滑），上翻呈「上浮」缓出
      const drop = lastDirectionRef.current === -1;
      const ease = drop
        ? "cubic-bezier(0.22, 0.9, 0.36, 0.95)"
        : "cubic-bezier(0.22, 0.2, 0.36, 1)";
      track.style.transition = animated ? `transform ${transitionMs}ms ${ease}` : "none";
      track.style.transform = `translate3d(0, ${-i * 100}svh, 0)`;
    },
    [reduce, transitionMs, trackRef],
  );

  const updateIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(sections.length - 1, i));
      if (clamped === indexRef.current) return;
      indexRef.current = clamped;
      setIndexState(clamped);
      onIndexChange?.(clamped);
      const section = sections[clamped];
      if (section) {
        window.dispatchEvent(
          new CustomEvent<SectionChangeDetail>(SECTION_CHANGE_EVENT, {
            detail: { navKey: section.navKey },
          }),
        );
      }
    },
    [sections, onIndexChange],
  );

  /** 派发冲量事件（供 GlowParticles 消费），reduced-motion 不派发。 */
  const dispatchImpulse = useCallback(
    (direction: TurnIntent) => {
      if (reduce) return;
      const now = performance.now();
      if (now - lastImpulseTimeRef.current < 300) return;
      lastImpulseTimeRef.current = now;
      window.dispatchEvent(
        new CustomEvent<ImpulseDetail>(IMPULSE_EVENT, { detail: { direction } }),
      );
    },
    [reduce],
  );

  const turn = useCallback(
    (direction: TurnIntent) => {
      if (freeRef.current) return;
      if (indexRef.current === assetsIndex && direction === -1) {
        // 素材站下滚越界 → 进入 free 模式，浏览器接管自然滚动
        freeRef.current = true;
        setFree(true);
        if (containerRef.current) containerRef.current.style.overflow = "auto";
        return;
      }
      const target = nextIndex(indexRef.current, direction, sections.length);
      if (target === indexRef.current) return;
      lastDirectionRef.current = direction;
      dispatchImpulse(direction);
      updateIndex(target);
    },
    [assetsIndex, sections.length, containerRef, dispatchImpulse, updateIndex],
  );

  /** 程序化跳转（导航/指示器点击），同翻页转场。 */
  const goTo = useCallback(
    (i: number) => {
      if (freeRef.current) {
        freeRef.current = false;
        setFree(false);
        if (containerRef.current) {
          containerRef.current.style.overflow = "hidden";
          containerRef.current.scrollTop = 0;
        }
        lastScrollTopRef.current = 0;
      }
      dispatchImpulse(i > indexRef.current ? -1 : 1);
      lastDirectionRef.current = i > indexRef.current ? -1 : 1;
      updateIndex(i);
    },
    [containerRef, dispatchImpulse, updateIndex],
  );

  // 初始：挂载时解析 hash 直落对应站（无转场）。仅挂载执行一次（landedRef 守卫），
  // 挂载后的 hash 变化由 hashchange 监听负责；避免因 sections 引用变化导致逐帧重跑与振荡。
  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current || sections.length === 0) return;
    const hash = window.location.hash;
    const match = sections.findIndex((s) => `#${s.id}` === hash);
    if (match > 0) {
      landedRef.current = true;
      requestAnimationFrame(() => {
        indexRef.current = match;
        setIndexState(match);
        onIndexChange?.(match);
        applyTransform(match, false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 索引变化 → 同步 hash（replaceState，不触发跳转）。首渲染不写 transform（SSG 直出站 0）。
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const section = sectionsRef.current[indexRef.current];
    if (section && window.location.hash !== section.hash) {
      history.replaceState(null, "", section.hash);
    }
    // 转场：常规 transform 过渡；reduced-motion 为短促 opacity 淡切（applyTransform 内实现）
    applyTransform(indexRef.current, true);
  }, [index, applyTransform]);

  // 响应 hash 变化（浏览器前进后退 / 直接 URL 定位）：解析 hash 定位到对应站
  useEffect(() => {
    const onHashChange = () => {
      if (blockedRef.current) return;
      const hash = window.location.hash;
      const match = sectionsRef.current.findIndex((s) => `#${s.id}` === hash);
      if (match >= 0 && match !== indexRef.current) {
        goTo(match);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [goTo]);

  // 响应导航锚点点击（NavBar 派发，Next Link pushState 不触发 hashchange）
  useEffect(() => {
    const onNavigate = (e: Event) => {
      if (blockedRef.current) return;
      const detail = (e as CustomEvent<NavigateDetail>).detail;
      if (!detail || !detail.id) return;
      const match = sectionsRef.current.findIndex((s) => s.id === detail.id);
      if (match >= 0 && match !== indexRef.current) {
        goTo(match);
      }
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => window.removeEventListener(NAVIGATE_EVENT, onNavigate);
  }, [goTo]);

  /** 判断触摸起始目标是否位于可滚动兜底列内（移动端档案内容列），是则不喂入手势聚合（交给原生滚动）。 */
  const isInsideScrollable = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return !!target.closest("[data-fullpage-scrollable]");
  }, []);

  // 事件监听（window 级被动，不 preventDefault）
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (blockedRef.current) return;
      const intent = feedWheel(gestureRef.current, e.deltaY, performance.now());
      if (intent) turn(intent.direction);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (blockedRef.current) return;
      // 位于可滚动内容列内的触摸交给原生滚动，不参与整页手势
      if (isInsideScrollable(e.target)) {
        touchStartRef.current = null;
        return;
      }
      const t = e.touches[0];
      touchStartRef.current = t ? { y: t.clientY, timestamp: performance.now() } : null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (blockedRef.current || !touchStartRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const intent = feedTouch(
        gestureRef.current,
        { y: touchStartRef.current.y },
        { y: t.clientY },
        performance.now(),
      );
      if (intent) turn(intent.direction);
    };
    const onTouchEnd = () => {
      touchStartRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (blockedRef.current) return;
      const map: Record<string, TurnIntent> = {
        ArrowDown: -1,
        ArrowUp: 1,
        PageDown: -1,
        PageUp: 1,
      };
      if (e.key === "Home") {
        goTo(0);
        return;
      }
      if (e.key === "End") {
        goTo(sectionsRef.current.length - 1);
        return;
      }
      const d = map[e.key];
      if (d) {
        e.preventDefault();
        turn(d);
      }
    };
    const onScroll = () => {
      if (!freeRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const scrollTop = el.scrollTop;
      // 回顶继续上滚 → 回收为 deck 并翻上一站
      if (scrollTop <= BOUNDARY_DEADZONE && scrollTop - lastScrollTopRef.current < 0) {
        freeRef.current = false;
        setFree(false);
        el.style.overflow = "hidden";
        lastScrollTopRef.current = 0;
        updateIndex(Math.max(0, indexRef.current - 1));
        return;
      }
      // free 模式滚动速度 → 连续喂入粒子冲量（沿滚动方向）
      if (!reduce) {
        const dt = Math.max(1, performance.now() - lastScrollTimeRef.current);
        const velocity = ((scrollTop - lastScrollTopRef.current) * 1000) / dt;
        lastScrollTimeRef.current = performance.now();
        if (Math.abs(velocity) > 1) {
          const now = performance.now();
          if (now - lastImpulseTimeRef.current > 30) {
            lastImpulseTimeRef.current = now;
            window.dispatchEvent(
              new CustomEvent(SCROLL_IMPULSE_EVENT, {
                detail: { velocity },
              }),
            );
          }
        }
      }
      lastScrollTopRef.current = scrollTop;
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    const container = containerRef.current;
    container?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      container?.removeEventListener("scroll", onScroll);
    };
  }, [turn, goTo, updateIndex, containerRef, reduce, isInsideScrollable]);

  // 弹层打开/关闭屏蔽翻页
  const setLocked = useCallback((locked: boolean) => {
    blockedRef.current = locked;
    setBlocked(locked);
  }, []);

  return { index, free, blocked, goTo, turn, setLocked };
}