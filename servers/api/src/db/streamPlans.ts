import { Schema, model, type Model } from "mongoose";

export interface StreamPlanDoc {
  _id: { toString(): string };
  date: string;
  startTime: string;
  title: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

const streamPlanSchema = new Schema<StreamPlanDoc>(
  {
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
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
  startTime: string;
  title: string;
  createdAt: Date;
  updatedAt?: Date;
}

function toOutput(doc: StreamPlanDoc): StreamPlanOutput {
  return {
    id: doc._id.toString(),
    date: doc.date,
    startTime: doc.startTime,
    title: doc.title,
    createdAt: doc.createdAt,
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

export async function createStreamPlan(input: {
  date: string;
  startTime: string;
  title: string;
  createdBy: string;
}): Promise<StreamPlanOutput> {
  const doc = new StreamPlanModel({
    date: input.date,
    startTime: input.startTime,
    title: input.title,
    createdBy: input.createdBy,
  });
  await doc.save();
  return toOutput(doc.toObject());
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
    .sort({ date: 1, startTime: 1 })
    .lean();
  return docs.map(toOutput);
}

/** 按 (date, startTime, title) 判重；excludeId 时排除自身（编辑场景）。 */
export async function findStreamPlan(
  date: string,
  startTime: string,
  title: string,
  excludeId?: string,
): Promise<StreamPlanDoc | null> {
  const conditions: Record<string, unknown> = { date, startTime, title };
  if (excludeId) conditions._id = { $ne: excludeId };
  return StreamPlanModel.findOne(conditions).lean();
}

export async function updateStreamPlan(
  id: string,
  input: { date: string; startTime: string; title: string },
): Promise<StreamPlanOutput | null> {
  const doc = await StreamPlanModel.findByIdAndUpdate(
    id,
    { $set: { date: input.date, startTime: input.startTime, title: input.title, updatedAt: new Date() } },
    { new: true },
  ).lean();
  return doc ? toOutput(doc) : null;
}

export async function deleteStreamPlan(id: string): Promise<boolean> {
  const res = await StreamPlanModel.deleteOne({ _id: id });
  return res.deletedCount > 0;
}
