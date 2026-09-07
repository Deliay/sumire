import { z } from "zod";

export const TopicStatusSchema = z.enum(["upcoming", "collecting", "ended"]);
export type TopicStatus = z.infer<typeof TopicStatusSchema>;

export const TopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  charLimit: z.number(),
  aiReviewEnabled: z.boolean(),
  status: TopicStatusSchema,
  collectingStopped: z.boolean(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const TopicPublicInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  charLimit: z.number(),
  status: TopicStatusSchema,
});
export type TopicPublicInfo = z.infer<typeof TopicPublicInfoSchema>;

export const AiReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  filteredReason: z.string().optional(),
  ignoredByAdmin: z.boolean(),
});
export type AiReview = z.infer<typeof AiReviewSchema>;

export const MarshmallowSchema = z.object({
  id: z.string(),
  topicId: z.string(),
  content: z.string(),
  adopted: z.boolean(),
  aiReview: AiReviewSchema.nullable(),
  createdAt: z.string(),
});
export type Marshmallow = z.infer<typeof MarshmallowSchema>;
