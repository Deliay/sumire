import { readFileSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { parse } from "yaml";
import type { z } from "zod";
import { assetsSchema, profileSchema, siteSchema } from "./schemas";
import type { Asset, Profile, Site } from "./schemas";

export type { Asset, Anecdote, Milestone, Profile, Site } from "./schemas";

function loadYaml<T>(file: string, schema: z.ZodType<T>): T {
  const raw = readFileSync(path.join(process.cwd(), "content", file), "utf8");
  return schema.parse(parse(raw));
}

export const getSite = cache((): Site => loadYaml("site.yaml", siteSchema));

export const getProfile = cache((): Profile =>
  loadYaml("profile.yaml", profileSchema),
);

export const getAssets = cache((): Asset[] =>
  loadYaml("assets.yaml", assetsSchema),
);
