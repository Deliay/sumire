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

export const DefaultSchemeSchema = z.object({
  version: z.literal(1),
  global: z.object({
    align: TextAlignSchema,
    fontSize: z.number().min(16).max(60),
    color: z.string().max(20),
  }),
  days: z.array(DaySettingsSchema).length(7),
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