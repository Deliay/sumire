import { z } from "zod";

/**
 * 弹幕后台类型定义。LiveEvent 与契约 `contract/live-events.openapi.yaml`
 * 的 LiveEvent schema 逐字段一致：上游 B 站原始 payload 由服务端归一化，
 * 前端不感知 B 站结构。
 */

export const LiveEventTypeSchema = z.enum(["danmaku", "super_chat", "gift", "guard_buy"]);
export type LiveEventType = z.infer<typeof LiveEventTypeSchema>;

export const MedalSchema = z.object({
  name: z.string(),
  level: z.number().int(),
  color: z.string(),
});

export const SenderSchema = z.object({
  uid: z.number().int(),
  name: z.string(),
  /** 昵称罗马音标注；无假名或转写失败为 null，前端有则换行展示、无则不展示 */
  nameRomaji: z.string().nullable(),
  /** 头像 URL；guard_buy 上游无头像，为 null，前端兜底渲染 */
  face: z.string().nullable(),
  /** 粉丝团牌子；无牌子为 null */
  medal: MedalSchema.nullable(),
  /** 上船等级（3=舰长，2=提督，1=总督）；无上船为 null。仅身份标识。 */
  guardLevel: z.number().int().nullable(),
});

export const ScColorsSchema = z.object({
  backgroundStart: z.string(),
  backgroundEnd: z.string(),
  fontColor: z.string(),
});

export const LiveEventSchema = z.object({
  eventId: z.string(),
  type: LiveEventTypeSchema,
  occurredAt: z.string(),
  sender: SenderSchema,
  content: z.string().optional(),
  /** SC 留言罗马音标注（仅 super_chat）；无假名则不含该字段，前端有则换行展示、无则不展示 */
  contentRomaji: z.string().optional(),
  /** 弹幕表情图片（仅 danmaku）；存在时前端渲染为图片而非纯文本 */
  emote: z
    .object({ url: z.string(), name: z.string().optional(), width: z.number().int().optional(), height: z.number().int().optional() })
    .optional(),
  /** 金额（元）：SC 直接为元；礼物=金瓜子 combo_total_coin/1000；上船=price/1000 */
  price: z.number().optional(),
  scColors: ScColorsSchema.optional(),
  gift: z.object({ name: z.string(), count: z.number().int() }).optional(),
  guard: z
    .object({
      /** 3=舰长，2=提督，1=总督 */
      level: z.number().int(),
      name: z.string(),
      /** 数量（月数） */
      count: z.number().int(),
    })
    .optional(),
  read: z.boolean(),
});
export type LiveEvent = z.infer<typeof LiveEventSchema>;

/** 栏位配置：一栏展示若干事件类型。 */
export const ColumnConfigSchema = z.object({
  id: z.string().min(1),
  types: z.array(LiveEventTypeSchema).min(1),
});
export type ColumnConfig = z.infer<typeof ColumnConfigSchema>;
