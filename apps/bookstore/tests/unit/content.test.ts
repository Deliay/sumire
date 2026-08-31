// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assetOriginalUrl,
  assetOriginalWebpUrl,
  assetThumbnailUrl,
} from "@/lib/content/shared";
import {
  getAssets,
  getProfile,
  getSite,
} from "@/lib/content";

describe("content layer", () => {
  it("loads site config", () => {
    const site = getSite();
    expect(site.name).toBe("堇色书屋");
    expect(site.color).toBe("#b4a6bf");
    expect(site.links.bilibili).toContain("bilibili.com");
    expect(site.disclaimer).toContain("非官方");
  });

  it("loads profile with required facts", () => {
    const profile = getProfile();
    expect(profile.displayName).toBe("枝堇Sumire");
    expect(profile.birthday).toBe("04-02");
    expect(profile.race).toContain("藤");
    expect(profile.fanBadge).toBe("小粉螈");
    expect(profile.modelArtist).toBe("天雨Rainfall");
    expect(profile.milestones.length).toBeGreaterThanOrEqual(3);
    expect(profile.links.every((link) => link.url.startsWith("https://"))).toBe(
      true,
    );
  });

  it("profile 含按萌娘百科补充的喜好类型字段", () => {
    const profile = getProfile();
    expect(profile.bookAnimeTypes).toEqual(["通俗文学", "悬疑", "恐怖", "奇幻", "冒险", "中式"]);
    expect(profile.musicTypes).toEqual(["东方系列", "术力口", "电子纯音", "r&b"]);
    expect(profile.gameGenre).toBe("模拟经营");
    expect(profile.anecdotes.some((a) => a.title === "小姨驾到")).toBe(true);
  });

  it("loads assets and every original file exists", () => {
    const assets = getAssets();
    expect(assets.length).toBeGreaterThanOrEqual(5);
    for (const asset of assets) {
      const file = path.join(
        process.cwd(),
        "public/assets/original",
        asset.file,
      );
      expect(existsSync(file), `missing ${asset.file}`).toBe(true);
    }
  });

  it("builds asset urls from id and file", () => {
    const asset = getAssets()[0];
    expect(assetOriginalUrl(asset)).toBe(`/assets/original/${asset.file}`);
    expect(assetThumbnailUrl(asset)).toBe(`/assets/thumbnails/${asset.id}.webp`);
    expect(assetOriginalWebpUrl(asset)).toBe(
      `/assets/original/${asset.id}.webp`,
    );
  });
});
