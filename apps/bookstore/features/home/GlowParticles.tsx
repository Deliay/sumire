"use client";

import { useEffect, useRef } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  SPAWN_BIAS,
  SPAWN_RADIUS,
  createFlow,
  createParticle,
  decayFlow,
  impulse,
  maxParticles,
  spawnPosition,
  stepParticles,
  type Flow,
  type Particle,
  type StepOptions,
  type Vec2,
} from "@/features/home/glowParticles";
import { IMPULSE_EVENT, type ImpulseDetail } from "@/features/home/useFullpageScroll";

/** 粒子取色 token（运行时读 CSS 变量）。 */
const TOKEN_KEYS = ["--color-flower", "--color-primary", "--color-eye"] as const;
/** token 缺失时兜底色。 */
const FALLBACK_COLORS = ["#8b5fd6", "#b4a6bf", "#7fb0e6"];
/** 冲量衰减半衰期（秒）。 */
const FLOW_HALF_LIFE = 0.5;
/** 单次翻页冲量强度（px/s）。 */
const IMPULSE_STRENGTH = 260;

interface GlowParticlesProps {
  /** 便于测试注入的纯函数（默认取模块真实实现）。 */
  spawn?: typeof spawnPosition;
  create?: typeof createParticle;
  step?: typeof stepParticles;
  cap?: typeof maxParticles;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 绘制粒子：径向渐变圆点低 alpha 模拟柔光（不用 filter: blur）。 */
function draw(ctx: CanvasRenderingContext2D, particles: Particle[], colors: string[]): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const p of particles) {
    const rgb = hexToRgb(colors[p.colorIndex % colors.length] ?? "#ffffff");
    if (!rgb) continue;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${p.alpha})`);
    g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 背景光晕粒子层（Client）：Canvas 2D 主循环 spawn（指针偏置）→ step → draw。
 * DPR/resize 自适应、document.hidden 暂停、token 取色；reduced-motion 降级保留（减半降速去明灭）。
 */
export default function GlowParticles({
  spawn = spawnPosition,
  create = createParticle,
  step = stepParticles,
  cap = maxParticles,
}: GlowParticlesProps) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors: string[] = [];
    try {
      colors = TOKEN_KEYS.map((k) =>
        getComputedStyle(document.documentElement).getPropertyValue(k).trim(),
      ).filter(Boolean);
    } catch {
      /* 忽略读取异常 */
    }
    if (colors.length === 0) colors = FALLBACK_COLORS.slice();

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let particles: Particle[] = [];
    let pointer: Vec2 | null = null;
    let running = false;
    let rafId = 0;
    let hidden = document.hidden;
    let flow: Flow = createFlow();

    const maxCount = () => {
      const base = cap(w * h);
      return reduce ? Math.max(4, Math.round(base / 2)) : base;
    };
    const opts: StepOptions = { speed: reduce ? 0.5 : 1, flicker: !reduce, dt: 1 / 60 };

    const onPointer = (e: { clientX: number; clientY: number }) => {
      pointer = { x: e.clientX, y: e.clientY };
    };

    const onImpulse = (e: Event) => {
      // reduced-motion 不注入冲量（流场恒零）
      if (reduce) return;
      const detail = (e as CustomEvent<ImpulseDetail>).detail;
      if (detail && typeof detail.direction === "number") {
        flow = impulse(flow, detail.direction, IMPULSE_STRENGTH);
      }
    };

    const frame = () => {
      const target = maxCount();
      while (particles.length < target) {
        const pos = spawn({ width: w, height: h }, pointer, SPAWN_BIAS, SPAWN_RADIUS, Math.random);
        particles = [...particles, create(pos, Math.random)];
      }
      // 流场衰减 + 叠加
      flow = decayFlow(flow, opts.dt, FLOW_HALF_LIFE);
      particles = step(particles, opts.dt, opts, flow);
      draw(ctx, particles, colors);
      rafId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      if (running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (hidden) stop();
      else start();
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener(IMPULSE_EVENT, onImpulse);
    document.addEventListener("visibilitychange", onVisibility);

    if (!hidden) start();

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", resize);
      window.removeEventListener(IMPULSE_EVENT, onImpulse);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [reduce, spawn, create, step, cap]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-testid="glow-particles"
      className="pointer-events-none fixed inset-0"
    />
  );
}