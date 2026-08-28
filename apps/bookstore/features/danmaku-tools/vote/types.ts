import { z } from "zod";

export const voteOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  keyword: z.string().min(1),
  count: z.number().int().min(0),
});

export const voteStateSchema = z.object({
  options: z.array(voteOptionSchema),
  processed: z.number().int().min(0),
  matched: z.number().int().min(0),
  voterUids: z.array(z.number().int()),
});

export type VoteOption = z.infer<typeof voteOptionSchema>;
export type VoteState = z.infer<typeof voteStateSchema>;

export const EMPTY_VOTE_STATE: VoteState = {
  options: [],
  processed: 0,
  matched: 0,
  voterUids: [],
};
