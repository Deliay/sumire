import { z } from "zod";
import type { StreamPlan } from "../api";
import type { ISOWeek } from "./weekUtils";

export const TextAlignSchema = z.enum(["left", "center", "right"]);
export type TextAlign = z.infer<typeof TextAlignSchema>;

export const DaySettingsSchema = z.object({
  content: z.string(),
  align: TextAlignSchema.optional(),
  fontSize: z.number().min(16).max(60).optional(),
  color: z.string().max(20).optional(),
});
export type DaySettings = z.infer<typeof DaySettingsSchema>;

export const DateSchemeConfigSchema = z.object({
  enabled: z.boolean(),
  format: z.string(),
  content: z.string(),
  align: TextAlignSchema.optional(),
  fontSize: z.number().min(14).max(30).optional(),
  color: z.string().max(20).optional(),
});
export type DateSchemeConfig = z.infer<typeof DateSchemeConfigSchema>;

export const DefaultSchemeSchema = z.object({
  version: z.literal(1),
  global: z.object({
    align: TextAlignSchema,
    fontSize: z.number().min(16).max(60),
    color: z.string().max(20),
  }),
  days: z.array(DaySettingsSchema).length(7),
  date: DateSchemeConfigSchema.optional(),
});
export type DefaultScheme = z.infer<typeof DefaultSchemeSchema>;

export const WeekSchemeSchema = DefaultSchemeSchema.extend({
  week: z.object({
    year: z.number(),
    week: z.number(),
  }),
});
export type WeekScheme = z.infer<typeof WeekSchemeSchema>;

export function createDefaultScheme(): DefaultScheme {
  return {
    version: 1,
    global: { align: "left", fontSize: 40, color: "#5b4b68" },
    days: Array(7).fill({ content: "{schedules}" }),
  };
}

export function createDefaultDateConfig(): DateSchemeConfig {
  return {
    enabled: false,
    format: "{yyyy}年{mm}月{dd}日",
    content: "{开始日期} ~ {结束日期}",
  };
}

export function formatDate(dateStr: string, format: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const twoDigitYear = String(year).padStart(2, "0").slice(-2);

  return format
    .replaceAll("{yyyy}", String(year))
    .replaceAll("{yy}", twoDigitYear)
    .replaceAll("{mm}", monthStr)
    .replaceAll("{m}", String(month))
    .replaceAll("{dd}", dayStr)
    .replaceAll("{d}", String(day));
}

export function buildDateContent(template: string, startStr: string, endStr: string): string {
  if (template === "") return "";
  return template
    .replaceAll("{开始日期}", startStr)
    .replaceAll("{结束日期}", endStr);
}

export function resolveDateConfig(scheme: DefaultScheme): {
  enabled: boolean;
  format: string;
  content: string;
  align: TextAlign;
  fontSize: number;
  color: string;
} {
  const date = scheme.date;
  const defaultConfig = createDefaultDateConfig();

  let enabled = defaultConfig.enabled;
  let format = defaultConfig.format;
  let content = defaultConfig.content;

  if (date) {
    const parsed = DateSchemeConfigSchema.safeParse(date);
    if (parsed.success) {
      enabled = parsed.data.enabled;
      format = parsed.data.format;
      content = parsed.data.content;
    }
  }

  return {
    enabled,
    format,
    content,
    align: date?.align ?? scheme.global.align,
    fontSize: date?.fontSize ?? 20,
    color: date?.color ?? scheme.global.color,
  };
}

export function resolveEffectiveScheme(
  week: ISOWeek,
  store: {
    getWeek: (week: ISOWeek) => WeekScheme | null;
    getDefault: () => DefaultScheme;
  }
): DefaultScheme | WeekScheme {
  const weekScheme = store.getWeek(week);
  if (weekScheme) {
    const parsed = WeekSchemeSchema.safeParse(weekScheme);
    if (parsed.success) return parsed.data;
  }
  return store.getDefault();
}

export function buildDaySchedulesText(plans: StreamPlan[]): string {
  const sorted = [...plans].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return sorted.map((p) => `${p.startTime} ${p.title}`).join(" / ");
}

export function resolveDayText(template: string, schedules: string): string {
  return template.replaceAll("{schedules}", schedules);
}

export function ensureWeekScheme(base: DefaultScheme, week: ISOWeek): WeekScheme {
  const cloned = structuredClone(base);
  return {
    ...cloned,
    week,
  };
}