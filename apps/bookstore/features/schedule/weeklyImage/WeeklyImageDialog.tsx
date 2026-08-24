"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { listPlans, type StreamPlan } from "../api";
import { getISOWeek, getWeekRange, shiftWeek, formatWeekLabel, type ISOWeek } from "./weekUtils";
import { layoutWeek, type DrawInstruction, type Measure } from "./layout";
import { renderWeekImage } from "./renderer";
import {
  createDefaultScheme,
  createDefaultDateConfig,
  resolveEffectiveScheme,
  ensureWeekScheme,
  type DefaultScheme,
  type WeekScheme,
  type TextAlign,
  type DaySettings,
  type DateSchemeConfig,
} from "./scheme";
import { loadDefault, saveDefault, loadWeek, saveWeek, deleteWeek } from "./storage";

const DEFAULT_BASE_IMAGE_URL = "/assets/original/weekly-schedules-raw.jpg";
const WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

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
  const [editingDefault, setEditingDefault] = useState(false);
  const [scheme, setScheme] = useState<DefaultScheme | WeekScheme>(() => createDefaultScheme());
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

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

  // 打开时加载当前周的有效方案
  const prevWeekRef = useRef<string>("");
  useEffect(() => {
    if (!open) return;
    const weekKey = `${week.year}-${week.week}`;
    if (prevWeekRef.current !== weekKey) {
      prevWeekRef.current = weekKey;
      const store = {
        getWeek: loadWeek,
        getDefault: loadDefault,
      };
      const effective = resolveEffectiveScheme(week, store);
      setScheme(effective);
      setEditingDefault(false);
    }
  }, [open, week]);

  // 计划就绪后按当前周布局并绘制（切换周 / 计划变化 / 重试时重跑）
  useEffect(() => {
    if (!open || plans === null) return;
    let active = true;
    const { monday } = getWeekRange(week.year, week.week);
    const instructions = layoutWeek(plans, monday, canvasMeasure(), scheme);
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
  }, [open, week, plans, retryNonce, renderImage, baseImageUrl, scheme]);

  // 切换编辑默认方案模式
  const handleToggleEditingDefault = useCallback(() => {
    setEditingDefault((prev) => {
      const newEditing = !prev;
      if (newEditing) {
        // 进入编辑默认方案模式：加载默认方案
        const defaultScheme = loadDefault();
        setScheme(defaultScheme);
      } else {
        // 退出编辑默认方案模式：重新加载当前周的有效方案
        const store = {
          getWeek: loadWeek,
          getDefault: loadDefault,
        };
        const effective = resolveEffectiveScheme(week, store);
        setScheme(effective);
      }
      return newEditing;
    });
  }, [week]);

  // 全局设置变更
  const handleGlobalChange = useCallback(
    (updates: Partial<DefaultScheme["global"]>) => {
      setScheme((prev) => {
        const newScheme = {
          ...prev,
          global: { ...prev.global, ...updates },
        };
        if (editingDefault) {
          saveDefault(newScheme);
          return newScheme;
        } else {
          const weekScheme = ensureWeekScheme(newScheme, week);
          saveWeek(weekScheme);
          return weekScheme;
        }
      });
    },
    [editingDefault, week]
  );

  // 按天设置变更
  const handleDayChange = useCallback(
    (dayIndex: number, updates: Partial<DaySettings>) => {
      setScheme((prev) => {
        const newDays = [...prev.days];
        newDays[dayIndex] = { ...newDays[dayIndex], ...updates };
        const newScheme = {
          ...prev,
          days: newDays,
        };
        if (editingDefault) {
          saveDefault(newScheme);
          return newScheme;
        } else {
          const weekScheme = ensureWeekScheme(newScheme, week);
          saveWeek(weekScheme);
          return weekScheme;
        }
      });
    },
    [editingDefault, week]
  );

  // 切换展开/折叠某天
  const toggleDayExpanded = useCallback((dayIndex: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        next.delete(dayIndex);
      } else {
        next.add(dayIndex);
      }
      return next;
    });
  }, []);

  // 插入 {schedules} 变量
  const insertScheduleVariable = useCallback((dayIndex: number) => {
    setScheme((prev) => {
      const day = prev.days[dayIndex];
      const newContent = day.content.includes("{schedules}")
        ? day.content
        : day.content + "{schedules}";
      const newDays = [...prev.days];
      newDays[dayIndex] = { ...day, content: newContent };
      const newScheme = {
        ...prev,
        days: newDays,
      };
      // 持久化
      if (editingDefault) {
        saveDefault(newScheme);
      } else {
        const weekScheme = ensureWeekScheme(newScheme, week);
        saveWeek(weekScheme);
        return weekScheme;
      }
      return newScheme;
    });
  }, [editingDefault, week]);

  // 日期设置变更
  const handleDateChange = useCallback(
    (updates: Partial<DateSchemeConfig>) => {
      setScheme((prev) => {
        const currentDate = prev.date ?? createDefaultDateConfig();
        const newDate = { ...currentDate, ...updates };
        const newScheme = {
          ...prev,
          date: newDate,
        };
        if (editingDefault) {
          saveDefault(newScheme);
          return newScheme;
        } else {
          const weekScheme = ensureWeekScheme(newScheme, week);
          saveWeek(weekScheme);
          return weekScheme;
        }
      });
    },
    [editingDefault, week]
  );

  // 非默认方案场景：恢复为默认方案（删除本周方案，回退默认）
  const handleResetToDefault = useCallback(() => {
    deleteWeek(week);
    setScheme(loadDefault());
  }, [week]);

  // 编辑默认方案场景：恢复预设方案（撤销对默认方案的所有改动）
  const handleResetDefaultToPreset = useCallback(() => {
    const preset = createDefaultScheme();
    saveDefault(preset);
    setScheme(preset);
  }, []);

  if (!open) return null;

  const label = formatWeekLabel(week.year, week.week);
  const loading = dataUrl === "" && error === "";
  const isDefaultScheme = editingDefault || !("week" in scheme);

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
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-vine/50 bg-raised p-6 shadow-xl">
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

        {/* 设置面板 */}
        <div className="mt-4 border-t border-vine/30 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">
                {isDefaultScheme ? "默认方案" : `${scheme.week.year} 年第 ${scheme.week.week} 周方案`}
              </span>
              <button
                type="button"
                onClick={handleToggleEditingDefault}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  editingDefault
                    ? "bg-flower text-white"
                    : "border border-vine/50 text-ink-dim hover:text-ink"
                }`}
              >
                编辑默认方案
              </button>
              {editingDefault ? (
                <button
                  type="button"
                  onClick={handleResetDefaultToPreset}
                  className="rounded-md border border-vine/50 px-3 py-1 text-xs text-ink-dim hover:text-ink"
                >
                  恢复预设方案
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="rounded-md border border-vine/50 px-3 py-1 text-xs text-ink-dim hover:text-ink"
                >
                  恢复为默认方案
                </button>
              )}
            </div>
          </div>

          {/* 全局设置 */}
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">对齐</span>
              <div className="flex gap-1">
                {(["left", "center", "right"] as TextAlign[]).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => handleGlobalChange({ align })}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      scheme.global.align === align
                        ? "bg-flower text-white"
                        : "border border-vine/50 text-ink-dim hover:text-ink"
                    }`}
                  >
                    {align === "left" ? "左" : align === "center" ? "居中" : "右"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">字号</span>
              <input
                type="number"
                min={16}
                max={60}
                value={scheme.global.fontSize}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") return;
                  const num = Number(val);
                  if (num >= 16 && num <= 60) {
                    handleGlobalChange({ fontSize: num });
                  }
                }}
                className="w-16 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">颜色</span>
              <input
                type="color"
                value={scheme.global.color}
                onChange={(e) => handleGlobalChange({ color: e.target.value })}
                className="h-8 w-8 rounded border border-vine/50"
              />
              <input
                type="text"
                value={scheme.global.color}
                onChange={(e) => handleGlobalChange({ color: e.target.value })}
                className="w-20 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
              />
            </div>
          </div>

          {/* 日期设置 */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">日期设置</h3>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">日期格式</span>
              <input
                type="text"
                aria-label="日期格式"
                value={(scheme.date?.format ?? createDefaultDateConfig().format)}
                onChange={(e) => handleDateChange({ format: e.target.value })}
                className="flex-1 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
                placeholder="{yyyy}年{mm}月{dd}日"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">日期内容</span>
              <input
                type="text"
                aria-label="日期内容"
                value={(scheme.date?.content ?? createDefaultDateConfig().content)}
                onChange={(e) => handleDateChange({ content: e.target.value })}
                className="flex-1 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
                placeholder="{开始日期} ~ {结束日期}"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">对齐</span>
              <div className="flex gap-1">
                {([undefined, "left", "center", "right"] as (TextAlign | undefined)[]).map((align) => (
                  <button
                    key={align ?? "default"}
                    type="button"
                    onClick={() => handleDateChange({ align })}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      align === undefined
                        ? scheme.date?.align === undefined
                          ? "bg-flower text-white"
                          : "border border-vine/50 text-ink-dim hover:text-ink"
                        : scheme.date?.align === align
                          ? "bg-flower text-white"
                          : "border border-vine/50 text-ink-dim hover:text-ink"
                    }`}
                  >
                    {align === undefined ? "沿用" : align === "left" ? "左" : align === "center" ? "居中" : "右"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">字号</span>
              <input
                type="number"
                min={14}
                max={30}
                value={scheme.date?.fontSize ?? ""}
                placeholder="20"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    handleDateChange({ fontSize: undefined });
                    return;
                  }
                  const num = Number(val);
                  if (num >= 14 && num <= 30) {
                    handleDateChange({ fontSize: num });
                  }
                }}
                className="w-16 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-ink-dim">颜色</span>
              <input
                type="color"
                value={scheme.date?.color ?? scheme.global.color}
                onChange={(e) => handleDateChange({ color: e.target.value })}
                className="h-8 w-8 rounded border border-vine/50"
              />
              <input
                type="text"
                value={scheme.date?.color ?? ""}
                placeholder={scheme.global.color}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    handleDateChange({ color: undefined });
                  } else {
                    handleDateChange({ color: val });
                  }
                }}
                className="w-20 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
              />
            </div>
          </div>

          {/* 按天设置 */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-ink">按天设置</h3>
            {WEEKDAY_LABELS.map((label, dayIndex) => {
              const day = scheme.days[dayIndex];
              const isExpanded = expandedDays.has(dayIndex);
              const hasOverrides = day.align !== undefined || day.fontSize !== undefined || day.color !== undefined;
              
              return (
                <div key={dayIndex} className="rounded-md border border-vine/30 bg-night/50">
                  <button
                    type="button"
                    onClick={() => toggleDayExpanded(dayIndex)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-ink">
                      {label}
                      {hasOverrides && (
                        <span className="ml-2 text-xs text-flower">(已自定义)</span>
                      )}
                    </span>
                    <span className="text-ink-dim">{isExpanded ? "▲" : "▼"}</span>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-vine/20 px-3 py-3 space-y-3">
                      {/* 内容编辑 */}
                      <div>
                        <label className="block text-xs text-ink-dim mb-1">内容模板</label>
                        <div className="flex gap-2">
                          <textarea
                            value={day.content}
                            onChange={(e) => handleDayChange(dayIndex, { content: e.target.value })}
                            className="flex-1 rounded border border-vine/50 bg-raised px-2 py-1 text-sm text-ink resize-none"
                            rows={2}
                            placeholder="输入内容模板，使用 {schedules} 插入计划"
                          />
                          <button
                            type="button"
                            onClick={() => insertScheduleVariable(dayIndex)}
                            className="self-end rounded border border-vine/50 px-2 py-1 text-xs text-ink-dim hover:text-ink"
                          >
                            插入 {"{schedules}"}
                          </button>
                        </div>
                      </div>

                      {/* 覆盖对齐 */}
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-ink-dim">对齐覆盖</span>
                        <div className="flex gap-1">
                          {([undefined, "left", "center", "right"] as (TextAlign | undefined)[]).map((align) => (
                            <button
                              key={align ?? "default"}
                              type="button"
                              onClick={() => handleDayChange(dayIndex, { align })}
                              className={`rounded px-2 py-1 text-xs transition-colors ${
                                day.align === align
                                  ? "bg-flower text-white"
                                  : "border border-vine/50 text-ink-dim hover:text-ink"
                              }`}
                            >
                              {align === undefined ? "沿用" : align === "left" ? "左" : align === "center" ? "居中" : "右"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 覆盖字号 */}
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-ink-dim">字号覆盖</span>
                        <input
                          type="number"
                          min={16}
                          max={60}
                          value={day.fontSize ?? ""}
                          placeholder={String(scheme.global.fontSize)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleDayChange(dayIndex, { fontSize: undefined });
                              return;
                            }
                            const num = Number(val);
                            if (num >= 16 && num <= 60) {
                              handleDayChange(dayIndex, { fontSize: num });
                            }
                          }}
                          className="w-16 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
                        />
                      </div>

                      {/* 覆盖颜色 */}
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-ink-dim">颜色覆盖</span>
                        <input
                          type="color"
                          value={day.color ?? scheme.global.color}
                          onChange={(e) => handleDayChange(dayIndex, { color: e.target.value })}
                          className="h-6 w-6 rounded border border-vine/50"
                        />
                        <input
                          type="text"
                          value={day.color ?? ""}
                          placeholder={scheme.global.color}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleDayChange(dayIndex, { color: undefined });
                            } else {
                              handleDayChange(dayIndex, { color: val });
                            }
                          }}
                          className="w-20 rounded border border-vine/50 px-2 py-1 text-sm text-ink"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}