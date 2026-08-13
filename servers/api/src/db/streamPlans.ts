import { Schema, model, type Model } from "mongoose";

export interface StreamPlanDoc {
  _id: { toString(): string };
  date: string;
  title: string;
  createdBy: string;
  createdAt: Date;
}

const streamPlanSchema = new Schema<StreamPlanDoc>(
  {
    date: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
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
  title: string;
  createdAt: Date;
}

function toOutput(doc: StreamPlanDoc): StreamPlanOutput {
  return {
    id: doc._id.toString(),
    date: doc.date,
    title: doc.title,
    createdAt: doc.createdAt,
  };
}

export async function createStreamPlan(input: {
  date: string;
  title: string;
  createdBy: string;
}): Promise<StreamPlanOutput> {
  const doc = new StreamPlanModel({
    date: input.date,
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
    .sort({ date: 1, _id: 1 })
    .lean();
  return docs.map(toOutput);
}

export async function findStreamPlan(
  date: string,
  title: string,
): Promise<StreamPlanDoc | null> {
  return StreamPlanModel.findOne({ date, title }).lean();
}
