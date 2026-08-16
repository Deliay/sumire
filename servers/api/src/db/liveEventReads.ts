import { Schema, model, type Model } from "mongoose";

/**
 * live_event_reads 集合：弹幕后台已读状态持久化（提案 §4.1）。
 * - kind=read / unread：单条记录，eventId 唯一，最新操作覆盖 kind；
 * - kind=watermark：按类型的「全部已读」水位线（eventId 为 watermark:{type}），
 *   readBefore 只前进不后退（$max）。
 * 判定规则：单条记录存在时以 kind === "read" 为准（unread 显式撤销水位线覆盖）；
 * 无单条记录时 occurredAt <= readBefore 即已读。
 */

export type ReadKind = "read" | "unread" | "watermark";

export interface LiveEventReadDoc {
  eventId: string;
  type: string;
  kind: ReadKind;
  readBefore?: Date;
  readBy: string;
  readAt: Date;
}

const liveEventReadSchema = new Schema<LiveEventReadDoc>(
  {
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    kind: { type: String, enum: ["read", "unread", "watermark"], required: true },
    readBefore: { type: Date },
    readBy: { type: String, required: true },
    readAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);
liveEventReadSchema.index({ eventId: 1 }, { unique: true });
liveEventReadSchema.index({ type: 1, kind: 1 });

export const LiveEventReadModel: Model<LiveEventReadDoc> = model<LiveEventReadDoc>(
  "LiveEventRead",
  liveEventReadSchema,
  "live_event_reads",
);

export function watermarkEventId(type: string): string {
  return `watermark:${type}`;
}

/** 从归一化 eventId 前缀反推事件类型（dm/sc/gift/guard），未知前缀返回 null。 */
export function typeFromEventId(eventId: string): string | null {
  const prefix = eventId.split(":", 1)[0];
  const map: Record<string, string> = {
    dm: "danmaku",
    sc: "super_chat",
    gift: "gift",
    guard: "guard_buy",
  };
  return map[prefix] ?? null;
}

async function upsertSingle(eventId: string, kind: "read" | "unread", readBy: string): Promise<void> {
  await LiveEventReadModel.updateOne(
    { eventId },
    {
      $set: {
        kind,
        type: typeFromEventId(eventId) ?? "unknown",
        readBy,
        readAt: new Date(),
      },
      $unset: { readBefore: "" },
    },
    { upsert: true },
  );
}

/** 单条标记已读（幂等 upsert，覆盖既有 kind）。 */
export async function markRead(eventId: string, readBy: string): Promise<void> {
  await upsertSingle(eventId, "read", readBy);
}

/** 单条取消已读（幂等 upsert；显式 unread 记录优先于水位线，用于撤销「全部已读」覆盖）。 */
export async function markUnread(eventId: string, readBy: string): Promise<void> {
  await upsertSingle(eventId, "unread", readBy);
}

/** 按类型全部已读：写水位线记录，$max 保证 readBefore 只前进不后退。 */
export async function markAllRead(type: string, readBefore: Date, readBy: string): Promise<void> {
  await LiveEventReadModel.updateOne(
    { eventId: watermarkEventId(type) },
    {
      $set: { kind: "watermark", type, readBy, readAt: new Date() },
      $max: { readBefore },
    },
    { upsert: true },
  );
}

/** 已读判定：单条记录优先于水位线；无单条时 occurredAt <= readBefore 即已读。 */
export function computeRead(kind: ReadKind | undefined, readBefore: Date | undefined, occurredAt: string): boolean {
  if (kind !== undefined) return kind === "read";
  if (readBefore) return new Date(occurredAt).getTime() <= readBefore.getTime();
  return false;
}

export interface EventReadInput {
  eventId: string;
  type: string;
  occurredAt: string;
}

/**
 * 批量合并已读标记：一次查询取相关单条记录（eventId $in）与各类型最新水位线，
 * 返回带 read 字段的新数组（不改动入参对象）。
 */
export async function resolveReadState<T extends EventReadInput>(
  events: T[],
): Promise<Array<T & { read: boolean }>> {
  if (events.length === 0) return [];
  const eventIds = events.map((e) => e.eventId);
  const types = [...new Set(events.map((e) => e.type))];
  const [singles, watermarks] = await Promise.all([
    LiveEventReadModel.find({ eventId: { $in: eventIds }, kind: { $in: ["read", "unread"] } }).lean(),
    LiveEventReadModel.find({ kind: "watermark", type: { $in: types } }).lean(),
  ]);
  const singleMap = new Map(singles.map((d) => [d.eventId, d.kind]));
  const wmMap = new Map<string, Date>();
  for (const w of watermarks) {
    if (!w.readBefore) continue;
    const prev = wmMap.get(w.type);
    if (!prev || w.readBefore.getTime() > prev.getTime()) wmMap.set(w.type, w.readBefore);
  }
  return events.map((e) => ({
    ...e,
    read: computeRead(singleMap.get(e.eventId), wmMap.get(e.type), e.occurredAt),
  }));
}
