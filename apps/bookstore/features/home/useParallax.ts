"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { lerp, pointerOffset, tiltOffset } from "@/features/home/parallax";

/** 鼠标视差幅度上限（px）。 */
const PARALLAX_MAX = 12;
/** 每帧插值系数（平滑跟随，非瞬时跳变）。 */
const LERP_T = 0.08;
/** 收敛阈值：差值小于该值视为已到位，停帧省电。 */
const CONVERGENCE_EPS = 0.05;

type OrientationEventLike = {
  beta: number | null;
  gamma: number | null;
};

/**
 * 立绘视差 hook：接管 ref 元素的 transform。
 * - 桌面 window 级被动 pointermove → 目标偏移，rAF lerp 直写 transform（不触发 React 重渲染）；
 *   pointerleave/blur 目标归零回中；收敛后停帧省电。
 * - 移动端 deviceorientation：iOS（requestPermission 存在）首次 touchend 静默请求，成功挂监听，
 *   拒绝/异常静默放弃；无需权限平台直接挂监听。
 * - 卸载完整清理；初始不写任何 transform（SSG/首渲染一致）。
 * 注：展示向公开站氛围层不降级 reduced-motion（视差/传感器与常规一致）；后台 `/backdoor` 不受本模块影响。
 */
export function useParallax(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const max = PARALLAX_MAX;

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let rafId = 0;
    let running = false;
    let orientationAttached = false;
    let orientationHandler: ((e: OrientationEventLike) => void) | null = null;
    let touchRequested = false;

    const step = () => {
      curX = lerp(curX, targetX, LERP_T);
      curY = lerp(curY, targetY, LERP_T);
      const converged =
        Math.abs(curX - targetX) <= CONVERGENCE_EPS &&
        Math.abs(curY - targetY) <= CONVERGENCE_EPS;
      if (converged && targetX === 0 && targetY === 0) {
        curX = 0;
        curY = 0;
        el.style.transform = "none";
        running = false;
        return;
      }
      el.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      if (converged) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(step);
    };

    const ensureRunning = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(step);
      }
    };

    const setTarget = (x: number, y: number) => {
      targetX = x;
      targetY = y;
      ensureRunning();
    };

    const resetTarget = () => setTarget(0, 0);

    const onPointerMove = (e: PointerEvent) => {
      const { dx, dy } = pointerOffset(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
        max,
      );
      setTarget(dx, dy);
    };

    const onLeave = () => resetTarget();

    const attachOrientation = () => {
      if (orientationAttached || !("ondeviceorientation" in window)) return;
      orientationHandler = (e: OrientationEventLike) => {
        const { dx, dy } = tiltOffset(e.beta, e.gamma, max);
        setTarget(dx, dy);
      };
      window.addEventListener(
        "deviceorientation",
        orientationHandler as unknown as EventListener,
      );
      orientationAttached = true;
    };

    const detachOrientation = () => {
      if (orientationAttached && orientationHandler) {
        window.removeEventListener(
          "deviceorientation",
          orientationHandler as unknown as EventListener,
        );
      }
      orientationHandler = null;
      orientationAttached = false;
    };

    const onTouchEnd = () => {
      if (touchRequested) return;
      touchRequested = true;
      const DOE = (window as unknown as {
        DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
      }).DeviceOrientationEvent;
      if (!DOE || typeof DOE.requestPermission !== "function") {
        attachOrientation();
        return;
      }
      DOE.requestPermission()
        .then((state: string) => {
          if (state === "granted") attachOrientation();
        })
        .catch(() => {});
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    const DOE = (window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
    }).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      window.addEventListener("touchend", onTouchEnd, { passive: true });
    } else {
      attachOrientation();
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("touchend", onTouchEnd);
      detachOrientation();
      if (running) cancelAnimationFrame(rafId);
      el.style.transform = "none";
    };
  }, [ref]);
}