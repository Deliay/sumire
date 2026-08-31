"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { useParallax } from "@/features/home/useParallax";

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 立绘视差容器（Client）：内部挂 useParallax 接管 transform，
 * 透传 children 与调用方传入的 className（立绘定位类由 page.tsx 决定）。
 */
export default function ParallaxLayer({ children, className }: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  return (
    <div ref={ref} data-testid="parallax-layer" className={className}>
      {children}
    </div>
  );
}