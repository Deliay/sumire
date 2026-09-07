import { Schema, model, type Model } from "mongoose";

export type TopicStatus = "upcoming" | "collecting" | "ended";

export interface TopicDoc {
  _id: { toString(): string };
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  charLimit: number;
  aiReviewEnabled: boolean;
  collectingStopped: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

const topicSchema = new Schema<TopicDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    charLimit: { type: Number, required: true, min: 100, max: 10000 },
    aiReviewEnabled: { type: Boolean, required: true, default: true },
    collectingStopped: { type: Boolean, required: true, default: false },
    archived: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date },
  },
  { versionKey: false },
);

topicSchema.index({ createdAt: -1 });

export const TopicModel: Model<TopicDoc> = model<TopicDoc>(
  "Topic",
  topicSchema,
);

/** 派生主题状态（纯函数，不落库）。 */
export function deriveStatus(
  topic: { startAt: Date; endAt: Date; collectingStopped: boolean; archived: boolean },
  now: Date,
): TopicStatus {
  if (topic.archived) return "ended";
  if (now < topic.startAt) return "upcoming";
  if (topic.collectingStopped || now > topic.endAt) return "ended";
  return "collecting";
}

export interface TopicOutput {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  charLimit: number;
  aiReviewEnabled: boolean;
  status: TopicStatus;
  collectingStopped: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

function toOutput(doc: TopicDoc, now?: Date): TopicOutput {
  const nowDate = now ?? new Date();
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    startAt: doc.startAt,
    endAt: doc.endAt,
    charLimit: doc.charLimit,
    aiReviewEnabled: doc.aiReviewEnabled,
    status: deriveStatus(doc, nowDate),
    collectingStopped: doc.collectingStopped,
    archived: doc.archived,
    createdAt: doc.createdAt,
    ...(doc.updatedAt ? { updatedAt: doc.updatedAt } : {}),
  };
}

export async function createTopic(input: {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  charLimit: number;
  aiReviewEnabled?: boolean;
}): Promise<TopicOutput> {
  const doc = new TopicModel({
    title: input.title,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    charLimit: input.charLimit,
    aiReviewEnabled: input.aiReviewEnabled ?? true,
  });
  await doc.save();
  return toOutput(doc.toObject());
}

export async function listTopics(options?: {
  archived?: boolean;
}): Promise<TopicOutput[]> {
  const conditions: Record<string, unknown> = {};
  if (!options?.archived) {
    conditions.archived = false;
  }
  const docs = await TopicModel.find(conditions)
    .sort({ createdAt: -1 })
    .lean();
  return docs.map((doc) => toOutput(doc));
}

export async function findTopic(id: string): Promise<TopicDoc | null> {
  return TopicModel.findById(id).lean();
}

export async function findTopicOutput(id: string): Promise<TopicOutput | null> {
  const doc = await TopicModel.findById(id).lean();
  return doc ? toOutput(doc) : null;
}

export async function updateTopic(
  id: string,
  input: {
    title: string;
    description: string;
    startAt: Date;
    endAt: Date;
    charLimit: number;
    aiReviewEnabled?: boolean;
  },
): Promise<boolean> {
  const res = await TopicModel.findByIdAndUpdate(
    id,
    {
      $set: {
        title: input.title,
        description: input.description,
        startAt: input.startAt,
        endAt: input.endAt,
        charLimit: input.charLimit,
        ...(input.aiReviewEnabled !== undefined
          ? { aiReviewEnabled: input.aiReviewEnabled }
          : {}),
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
  return res !== null;
}

export async function setCollectingStopped(
  id: string,
  stopped: boolean,
): Promise<boolean> {
  const res = await TopicModel.findByIdAndUpdate(
    id,
    { $set: { collectingStopped: stopped, updatedAt: new Date() } },
    { new: true },
  );
  return res !== null;
}

export async function archiveTopic(id: string): Promise<boolean> {
  const res = await TopicModel.findByIdAndUpdate(
    id,
    { $set: { archived: true, updatedAt: new Date() } },
    { new: true },
  );
  return res !== null;
}

export async function restoreTopic(id: string): Promise<boolean> {
  const res = await TopicModel.findByIdAndUpdate(
    id,
    { $set: { archived: false, updatedAt: new Date() } },
    { new: true },
  );
  return res !== null;
}
