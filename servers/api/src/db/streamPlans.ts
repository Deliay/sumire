import { Schema, model, type Model } from "mongoose";

export type TimeType = "fixed" | "tbd" | "allDay";

export interface StreamPlanDoc {
  _id: { toString(): string };
  date: string;
  timeType?: TimeType;
  startTime?: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

const streamPlanSchema = new Schema<StreamPlanDoc>(
  {
    date: { type: String, required: true, index: true },
    timeType: { type: String, enum: ["fixed", "tbd", "allDay"], required: true, default: "fixed" },
    startTime: { type: String },
    title: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date },
  },
  { versionKey: false },
);

export const StreamPlanModel: Model<StreamPlanDoc> = model<StreamPlanDoc>(
  "StreamPlan",
  streamPlanSchema,
);

export interface StreamPlanOutput {
  id: string;
  date: string;
  timeType: TimeType;
  startTime: string | null;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
}

function toOutput(doc: StreamPlanDoc): StreamPlanOutput {
  return {
    id: doc._id.toString(),
    date: doc.date,
    timeType: doc.timeType ?? "fixed",
    startTime: doc.startTime ?? null,
    title: doc.title,
    createdAt: doc.createdAt,
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

export async function createStreamPlan(input: {
  date: string;
  timeType: TimeType;
  startTime: string | null;
  title: string;
  createdBy: string;
}): Promise<StreamPlanOutput> {
  const doc = new StreamPlanModel({
    date: input.date,
    timeType: input.timeType,
    startTime: input.timeType === "fixed" ? input.startTime : null,
    title: input.title,
    createdBy: input.createdBy,
  });
  await doc.save();
  return toOutput(doc.toObject());
}

/** 类型秩：allDay 0 / fixed 1 / tbd 2 */
function timeTypeRank(t: TimeType): number {
  return t === "allDay" ? 0 : t === "fixed" ? 1 : 2;
}

/** 比较两个计划：date 升序 → 类型秩 → startTime 升序（null 兜底空串） */
function comparePlans(a: StreamPlanOutput, b: StreamPlanOutput): number {
  const dateCmp = a.date.localeCompare(b.date);
  if (dateCmp !== 0) return dateCmp;
  const rankCmp = timeTypeRank(a.timeType) - timeTypeRank(b.timeType);
  if (rankCmp !== 0) return rankCmp;
  return (a.startTime ?? "").localeCompare(b.startTime ?? "");
}

export async function listStreamPlans(
  from?: string,
  to?: string,
): Promise<StreamPlanOutput[]> {
  const conditions: Record<string, unknown> = {};
  if (from && to) conditions.date = { $gte: from, $lte: to };
  else if (from) conditions.date = { $gte: from };
  else if (to) conditions.date = { $lte: to };
  const docs = await StreamPlanModel.find(conditions)
    .sort({ date: 1 })
    .lean();
  const outputs = docs.map(toOutput);
  outputs.sort(comparePlans);
  return outputs;
}

/** 按 (date, timeType, startTime, title) 判重；excludeId 时排除自身（编辑场景）。 */
export async function findStreamPlan(
  date: string,
  timeType: TimeType,
  startTime: string | null,
  title: string,
  excludeId?: string,
): Promise<StreamPlanDoc | null> {
  const conditions: Record<string, unknown> = {
    date,
    timeType,
    startTime: startTime ?? null,
    title,
  };
  if (excludeId) conditions._id = { $ne: excludeId };
  return StreamPlanModel.findOne(conditions).lean();
}

export async function updateStreamPlan(
  id: string,
  input: { date: string; timeType: TimeType; startTime: string | null; title: string },
): Promise<StreamPlanOutput | null> {
  const doc = await StreamPlanModel.findByIdAndUpdate(
    id,
    {
      $set: {
        date: input.date,
        timeType: input.timeType,
        startTime: input.timeType === "fixed" ? input.startTime : null,
        title: input.title,
        updatedAt: new Date(),
      },
    },
    { new: true },
  ).lean();
  return doc ? toOutput(doc) : null;
}

export async function deleteStreamPlan(id: string): Promise<boolean> {
  const res = await StreamPlanModel.deleteOne({ _id: id });
  return res.deletedCount > 0;
}
