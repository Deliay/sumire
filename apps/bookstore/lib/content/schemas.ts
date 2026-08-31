import { z } from "zod";

export const linkSchema = z.object({
  label: z.string().min(1),
  url: z.url(),
});

export const siteSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  disclaimer: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  links: z.object({
    bilibili: z.url(),
    live: z.url(),
    moegirl: z.url(),
  }),
});

export const milestoneSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1),
  note: z.string().optional(),
});

export const anecdoteSchema = z.object({
  title: z.string().min(1),
  emoji: z.string().min(1),
  body: z.string().min(1),
});

export const profileSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().min(1),
  displayName: z.string().min(1),
  birthday: z.string(),
  birthdayText: z.string(),
  zodiac: z.string(),
  race: z.string(),
  height: z.string(),
  identity: z.string(),
  agency: z.string(),
  generation: z.string(),
  fanBadge: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string(),
  modelArtist: z.string(),
  bio: z.string(),
  quote: z.string(),
  debutStory: z.string(),
  debutIntro: z.string(),
  likes: z.array(z.string()),
  dislikes: z.array(z.string()),
  games: z.array(z.string()),
  bookAnimeTypes: z.array(z.string()),
  musicTypes: z.array(z.string()),
  gameGenre: z.string(),
  milestones: z.array(milestoneSchema).min(1),
  anecdotes: z.array(anecdoteSchema),
  links: z.array(linkSchema).min(1),
});

export const assetCategorySchema = z.enum(["standing", "illustration", "promo"]);

export const assetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  category: assetCategorySchema,
  file: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().optional(),
  note: z.string().optional(),
});

export const assetsSchema = z.array(assetSchema);

export type Site = z.infer<typeof siteSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Anecdote = z.infer<typeof anecdoteSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetCategory = z.infer<typeof assetCategorySchema>;
