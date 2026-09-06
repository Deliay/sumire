import { Schema, model, type Model } from "mongoose";

export type AiReviewStatus = "pending" | "approved" | "rejected";

export interface AiReview {
  status: AiReviewStatus;
  filteredReason?: string;
  ignoredByAdmin: boolean;
}

export interface MarshmallowDoc {
  _id: { toString(): string };
  topicId: string;
  content: string;
  adopted: boolean;
  aiReview: AiReview | null;
  visitorId?: string;
  clientKeyHash?: string;
  ip?: string;
  createdAt: Date;
  updatedAt?: Date;
}

const aiReviewSchema = new Schema<AiReview>(
  {
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
    },
    filteredReason: { type: String },
    ignoredByAdmin: { type: Boolean, required: true, default: false },
  },
  { _id: false, versionKey: false },
);

const marshmallowSchema = new Schema<MarshmallowDoc>(
  {
    topicId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    adopted: { type: Boolean, required: true, default: false },
    aiReview: { type: aiReviewSchema, default: null },
    visitorId: { type: String },
    clientKeyHash: { type: String },
    ip: { type: String },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date },
  },
  { versionKey: false },
);

marshmallowSchema.index({ topicId: 1, createdAt: -1 });

export const MarshmallowModel: Model<MarshmallowDoc> = model<MarshmallowDoc>(
  "Marshmallow",
  marshmallowSchema,
);

export interface MarshmallowOutput {
  id: string;
  topicId: string;
  content: string;
  adopted: boolean;
  aiReview: AiReview | null;
  createdAt: Date;
}

function toOutput(doc: MarshmallowDoc): MarshmallowOutput {
  return {
    id: doc._id.toString(),
    topicId: doc.topicId,
    content: doc.content,
    adopted: doc.adopted,
    aiReview: doc.aiReview,
    createdAt: doc.createdAt,
  };
}

export async function createMarshmallow(input: {
  topicId: string;
  content: string;
  visitorId?: string;
  clientKeyHash?: string;
  ip?: string;
  aiReviewEnabled: boolean;
}): Promise<MarshmallowOutput> {
  const doc = new MarshmallowModel({
    topicId: input.topicId,
    content: input.content,
    visitorId: input.visitorId,
    clientKeyHash: input.clientKeyHash,
    ip: input.ip,
    aiReview: input.aiReviewEnabled
      ? { status: "pending", ignoredByAdmin: false }
      : null,
  });
  await doc.save();
  return toOutput(doc.toObject());
}

export async function listMarshmallows(
  topicId: string,
  options?: { page?: number; pageSize?: number },
): Promise<{ marshmallows: MarshmallowOutput[]; total: number }> {
  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;
  const [docs, total] = await Promise.all([
    MarshmallowModel.find({ topicId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    MarshmallowModel.countDocuments({ topicId }),
  ]);
  return { marshmallows: docs.map(toOutput), total };
}

export async function findMarshmallow(
  id: string,
): Promise<MarshmallowDoc | null> {
  return MarshmallowModel.findById(id).lean();
}

export async function setAdopted(
  id: string,
  adopted: boolean,
): Promise<boolean> {
  const res = await MarshmallowModel.findByIdAndUpdate(
    id,
    { $set: { adopted, updatedAt: new Date() } },
    { new: true },
  );
  return res !== null;
}

export async function setIgnoreAiFilter(
  id: string,
  ignored: boolean,
): Promise<boolean> {
  const res = await MarshmallowModel.findByIdAndUpdate(
    id,
    {
      $set: {
        "aiReview.ignoredByAdmin": ignored,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
  return res !== null;
}

export async function writeReviewResult(
  id: string,
  status: "approved" | "rejected",
  filteredReason?: string,
): Promise<boolean> {
  // I13: 不触碰 ignoredByAdmin 字段，保留管理员在 pending 期间的设置
  const update: Record<string, unknown> = {
    "aiReview.status": status,
    updatedAt: new Date(),
  };
  if (filteredReason !== undefined) {
    update["aiReview.filteredReason"] = filteredReason;
  }
  const res = await MarshmallowModel.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true },
  );
  return res !== null;
}

export async function listPendingReview(): Promise<MarshmallowDoc[]> {
  return MarshmallowModel.find({ "aiReview.status": "pending" })
    .sort({ createdAt: 1 })
    .lean();
}
