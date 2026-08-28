import type { StreamPlan } from "../api";
import type { DefaultScheme, TextAlign } from "./scheme";
import { createDefaultScheme, buildDaySchedulesText, resolveDayText, resolveDateConfig, formatDate, buildDateContent } from "./scheme";

export interface DrawInstruction {
  /** 周内第几天（0=周一 … 6=周日），-1=日期指令 */
  dayIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  align: TextAlign;
  color: string;
  textWidth: number;
}

/** 素材每日区域坐标（见 public/assets/original/AGENTS.md）。 */
export const ROW_X = 365;
export const ROW_Y = [278, 379, 480, 580, 681, 782, 883] as const;
export const ROW_WIDTH = 715;
export const ROW_HEIGHT = 70;
export const BASE_FONT_SIZE = 40;
export const MIN_FONT_SIZE = 22;

/** 日期区域坐标（见 public/assets/original/AGENTS.md）。 */
export const DATE_X = 640;
export const DATE_Y = 80;
export const DATE_WIDTH = 451;
export const DATE_HEIGHT = 40;
export const DATECONFIG_DEFAULT_FONT_SIZE = 20;
export const DATECONFIG_MAX_FONT_SIZE = 30;
export const DATECONFIG_MIN_FONT_SIZE = 14;

export type Measure = (text: string, fontSize: number) => number;

/** 两日期（YYYY-MM-DD）相差天数（to - from）。 */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd);
  const b = new Date(ty, tm - 1, td);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** 单日文本按字号自适应：自基准字号 shrink-to-fit 纳入宽度，触底仍超宽则截断加「…」。 */
function fitToWidth(text: string, width: number, measure: Measure, baseFontSize: number = BASE_FONT_SIZE, minFontSize: number = MIN_FONT_SIZE): { text: string; fontSize: number } {
  let fontSize = baseFontSize;
  while (fontSize > minFontSize && measure(text, fontSize) > width) {
    fontSize -= 2;
  }
  if (measure(text, fontSize) <= width) {
    return { text, fontSize };
  }
  let trimmed = text;
  while (trimmed.length > 0 && measure(trimmed + "…", minFontSize) > width) {
    trimmed = trimmed.slice(0, -1);
  }
  return { text: trimmed + "…", fontSize: minFontSize };
}

/** 获取周日日期字符串 */
function getSunday(monday: string): string {
  const [yearStr, monthStr, dayStr] = monday.split("-").map(Number);
  const date = new Date(yearStr, monthStr - 1, dayStr + 6);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 布局纯函数：输入计划（含 date+startTime）与周一日期，输出该周各天的绘制指令。
 * 同日多场按 startTime 升序以「 / 」连接为单行；仅输出周一~周日范围内的计划。
 * 额外产出日期指令（dayIndex=-1）。
 */
export function layoutWeek(
  plans: StreamPlan[],
  monday: string,
  measure: Measure,
  scheme: DefaultScheme = createDefaultScheme()
): DrawInstruction[] {
  const byDay = new Map<number, StreamPlan[]>();
  for (const plan of plans) {
    const dayIndex = daysBetween(monday, plan.date);
    if (dayIndex < 0 || dayIndex >= 7) continue;
    const arr = byDay.get(dayIndex) ?? [];
    arr.push(plan);
    byDay.set(dayIndex, arr);
  }

  const instructions: DrawInstruction[] = [];

  // 日期指令（仅当 enabled 为 true 时产出）
  const dateConfig = resolveDateConfig(scheme);
  if (dateConfig.enabled) {
    const sunday = getSunday(monday);
    const startStr = formatDate(monday, dateConfig.format);
    const endStr = formatDate(sunday, dateConfig.format);
    const dateText = buildDateContent(dateConfig.content, startStr, endStr);

    if (dateText !== "") {
      const { text: fitted, fontSize } = fitToWidth(dateText, DATE_WIDTH, measure, dateConfig.fontSize, DATECONFIG_MIN_FONT_SIZE);
      const textWidth = measure(fitted, fontSize);
      instructions.push({
        dayIndex: -1,
        x: DATE_X,
        y: DATE_Y,
        width: DATE_WIDTH,
        height: DATE_HEIGHT,
        text: fitted,
        fontSize,
        align: dateConfig.align,
        color: dateConfig.color,
        textWidth,
      });
    }
  }

  // 每日指令
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayPlans = byDay.get(dayIndex) ?? [];
    const dayPlan = scheme.days[dayIndex];
    const schedules = buildDaySchedulesText(dayPlans);
    const content = resolveDayText(dayPlan.content, schedules);

    if (content === "") continue;

    const effectiveFontSize = dayPlan.fontSize ?? scheme.global.fontSize;
    const { text: fitted, fontSize } = fitToWidth(content, ROW_WIDTH, measure, effectiveFontSize);
    const textWidth = measure(fitted, fontSize);
    const align = dayPlan.align ?? scheme.global.align;
    const color = dayPlan.color ?? scheme.global.color;

    instructions.push({
      dayIndex,
      x: ROW_X,
      y: ROW_Y[dayIndex],
      width: ROW_WIDTH,
      height: ROW_HEIGHT,
      text: fitted,
      fontSize,
      align,
      color,
      textWidth,
    });
  }
  return instructions;
}
