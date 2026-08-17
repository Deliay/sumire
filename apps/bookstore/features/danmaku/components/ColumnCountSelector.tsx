"use client";

import { useSyncExternalStore } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  COLUMN_PRESETS,
  getColumnsServerSnapshot,
  getColumnsSnapshot,
  resolveColumns,
  saveColumns,
  subscribeColumns,
  type ViewportTier,
} from "../columns";

/**
 * 「视图栏」选择器：按视口约束切换栏数（narrow 隐藏，medium 1/2 栏，wide 2/3 栏）。
 * 独立于 DanmakuDashboard 存在，供弹幕看板页头与「全屏模式/退出全屏」按钮同排展示；
 * 与 Dashboard 同源（localStorage 快照 + 视口档位），切换写入预设后经订阅同步至各栏。
 */
export default function ColumnCountSelector() {
  const storedColumns = useSyncExternalStore(
    subscribeColumns,
    getColumnsSnapshot,
    getColumnsServerSnapshot,
  );
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const isWide = useMediaQuery("(min-width: 1024px)");
  const tier: ViewportTier = isNarrow ? "narrow" : isWide ? "wide" : "medium";
  const columns = resolveColumns(storedColumns, tier);
  const columnCountOptions = tier === "narrow" ? [] : tier === "medium" ? [1, 2] : [2, 3];

  if (columnCountOptions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="danmaku-column-count" className="text-xs text-ink-dim">
        视图栏
      </label>
      <select
        id="danmaku-column-count"
        value={columns.length}
        onChange={(e) => saveColumns(COLUMN_PRESETS[Number(e.target.value) as 1 | 2 | 3])}
        aria-label="视图栏"
        className="rounded-md border border-vine/50 bg-raised px-2 py-1 text-xs text-ink transition-colors duration-150 hover:border-flower"
      >
        {columnCountOptions.map((n) => (
          <option key={n} value={n}>
            {n} 栏
          </option>
        ))}
      </select>
    </div>
  );
}
