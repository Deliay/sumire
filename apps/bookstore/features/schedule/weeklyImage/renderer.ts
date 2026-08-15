"use client";

import type { DrawInstruction } from "./layout";

export const CANVAS_WIDTH = 1665;
export const CANVAS_HEIGHT = 1080;
export const TEXT_COLOR = "#342a40";
export const FONT_STACK = '"Noto Serif SC", serif';
const FONT_SPEC = `600 40px ${FONT_STACK}`;

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
 */
export async function renderWeekImage(
  baseImageUrl: string,
  instructions: DrawInstruction[],
): Promise<string> {
  const [img] = await Promise.all([loadImage(baseImageUrl), ensureFont()]);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 2D 绘图上下文");

  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = "middle";
  for (const ins of instructions) {
    ctx.font = `600 ${ins.fontSize}px ${FONT_STACK}`;
    const centerY = ins.y + ins.height / 2;
    ctx.fillText(ins.text, ins.x, centerY);
  }
  return canvas.toDataURL("image/png");
}
