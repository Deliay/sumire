"use client";

import type { DrawInstruction } from "./layout";
import type { TextAlign } from "./scheme";

export const CANVAS_WIDTH = 1665;
export const CANVAS_HEIGHT = 1080;
export const TEXT_COLOR = "#342a40";
export const FONT_STACK = '"Noto Serif SC", serif';
const FONT_SPEC = `600 40px ${FONT_STACK}`;

/**
 * 根据对齐方式计算文本绘制的 x 坐标。
 * left: x
 * center: x + (width - textWidth) / 2
 * right: x + width - textWidth
 * 并 clamp 到 [x, x + width - textWidth] 防越界。
 */
export function computeTextX(align: TextAlign, x: number, width: number, textWidth: number): number {
  const minX = x;
  const maxX = x + width - textWidth;
  
  if (textWidth > width) {
    return minX;
  }
  
  switch (align) {
    case "left":
      return minX;
    case "center":
      return x + (width - textWidth) / 2;
    case "right":
      return maxX;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("素材加载失败"));
    img.src = src;
  });
}

/** 等待周表字体就绪；失败则降级为已加载 serif 族并告警。 */
async function ensureFont(): Promise<void> {
  try {
    await document.fonts.load(FONT_SPEC);
  } catch {
    console.warn("周表字体加载失败，降级为系统衬线字体");
  }
}

/**
 * 将一周的绘制指令渲染到素材底图上，导出 PNG dataURL。
 * 底图与字体并行预加载，就绪后绘制（画布固定 1665×1080 内部分辨率）。
 * 使用 2× 超采样 + imageSmoothingQuality: "high" 实现文字抗锯齿。
 */
export async function renderWeekImage(
  baseImageUrl: string,
  instructions: DrawInstruction[],
): Promise<string> {
  const [img] = await Promise.all([loadImage(baseImageUrl), ensureFont()]);

  // 离屏 canvas 2× 分辨率
  const offscreen = document.createElement("canvas");
  offscreen.width = CANVAS_WIDTH * 2;
  offscreen.height = CANVAS_HEIGHT * 2;
  const offCtx = offscreen.getContext("2d");
  if (!offCtx) throw new Error("无法获取 2D 绘图上下文");

  offCtx.scale(2, 2);
  offCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  offCtx.textBaseline = "middle";
  for (const ins of instructions) {
    offCtx.font = `600 ${ins.fontSize}px ${FONT_STACK}`;
    offCtx.fillStyle = ins.color;
    const centerY = ins.y + ins.height / 2;
    const x = computeTextX(ins.align, ins.x, ins.width, ins.textWidth);
    offCtx.fillText(ins.text, x, centerY);
  }

  // 目标 canvas 1× 分辨率，使用高质量平滑缩回
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 2D 绘图上下文");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  return canvas.toDataURL("image/png");
}
