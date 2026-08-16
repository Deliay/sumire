"use client";

import { useEffect, useState } from "react";
import { listPlans, type StreamPlan } from "../api";
import { getISOWeek, getWeekRange, shiftWeek, formatWeekLabel, type ISOWeek } from "./weekUtils";
import { layoutWeek, type DrawInstruction, type Measure } from "./layout";
import { renderWeekImage } from "./renderer";

const DEFAULT_BASE_IMAGE_URL = "/assets/original/weekly-schedules-raw.jpg";

let measureCache: Measure | null = null;

/** 基于 Canvas 的文本宽度测量（懒创建、复用），不可用时退化为按字符数近似。 */
function canvasMeasure(): Measure {
  if (measureCache) return measureCache;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    measureCache = (text) => text.length * 40;
  } else {
    measureCache = (text, fontSize) => {
      ctx.font = `600 ${fontSize}px "Noto Serif SC", serif`;
      return ctx.measureText(text).width;
    };
  }
  return measureCache;
}

interface WeeklyImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** 可注入的渲染函数（单测打桩），缺省用真实 Canvas 渲染。 */
  renderImage?: (baseUrl: string, instructions: DrawInstruction[]) => Promise<string>;
  baseImageUrl?: string;
}

/** 生成周表图片弹层：周切换器 + 素材底图预览 + 长按/右键保存提示。 */
export default function WeeklyImageDialog({
  open,
  onClose,
  renderImage = renderWeekImage,
  baseImageUrl = DEFAULT_BASE_IMAGE_URL,
}: WeeklyImageDialogProps) {
  const [plans, setPlans] = useState<StreamPlan[] | null>(null);
  const [week, setWeek] = useState<ISOWeek>(() => getISOWeek(new Date()));
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  // 打开时一次性拉全量计划（切换周不重发请求）
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const { status, data } = await listPlans();
      if (!active) return;
      setPlans(status === 200 && "plans" in data ? data.plans : []);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // 计划就绪后按当前周布局并绘制（切换周 / 计划变化 / 重试时重跑）
  useEffect(() => {
    if (!open || plans === null) return;
    let active = true;
    const { monday } = getWeekRange(week.year, week.week);
    const instructions = layoutWeek(plans, monday, canvasMeasure());
    void (async () => {
      try {
        const url = await renderImage(baseImageUrl, instructions);
        if (!active) return;
        setDataUrl(url);
        setError("");
      } catch {
        if (!active) return;
        setError("周表素材加载失败，请重试");
        setDataUrl("");
      }
    })();
    return () => {
      active = false;
    };
  }, [open, week, plans, retryNonce, renderImage, baseImageUrl]);

  if (!open) return null;

  const label = formatWeekLabel(week.year, week.week);
  const loading = dataUrl === "" && error === "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-image-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border border-vine/50 bg-raised p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 id="weekly-image-title" className="font-serif text-xl font-semibold text-ink">
            生成周表图片
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-dim transition-colors hover:text-ink"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setWeek((w) => shiftWeek(w.year, w.week, -1))}
            className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
            aria-label="上一周"
          >
            ←
          </button>
          <span className="font-serif text-lg font-semibold text-ink">{label}</span>
          <button
            type="button"
            onClick={() => setWeek((w) => shiftWeek(w.year, w.week, 1))}
            className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
            aria-label="下一周"
          >
            →
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center rounded-md border border-vine/40 bg-night p-3">
          {loading ? (
            <div
              className="flex aspect-[1665/1080] w-full items-center justify-center text-ink-dim"
              aria-busy="true"
            >
              生成中…
            </div>
          ) : error ? (
            <div className="flex aspect-[1665/1080] w-full flex-col items-center justify-center gap-3">
              <p className="text-sm text-flower">{error}</p>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="rounded-md border border-vine/50 px-3 py-1 text-sm text-ink-dim hover:text-ink"
              >
                重试
              </button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- 长按/右键保存依赖原生 <img>
            <img src={dataUrl} alt="周表图片" className="w-full rounded" referrerPolicy="no-referrer" />
          )}
        </div>

        <p className="mt-3 text-center text-xs text-ink-dim">长按保存图片，或右键另存为</p>
      </div>
    </div>
  );
}
