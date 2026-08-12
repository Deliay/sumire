/**
 * 从 public/assets/original/ 的原图生成列表/展示用 webp 缩略图。
 * 输出到 public/assets/thumbnails/<id>.webp（保留透明通道，最长边 1000px）。
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { parse } from "yaml";
import { z } from "zod";

const MAX_EDGE = 1000;

const assetsSchema = z.array(
  z.object({ id: z.string(), file: z.string() }),
);

async function main() {
  const root = process.cwd();
  const originalDir = path.join(root, "public/assets/original");
  const thumbnailDir = path.join(root, "public/assets/thumbnails");
  await mkdir(thumbnailDir, { recursive: true });

  const raw = await readFile(path.join(root, "content/assets.yaml"), "utf8");
  const assets = assetsSchema.parse(parse(raw));

  for (const asset of assets) {
    const source = path.join(originalDir, asset.file);
    const target = path.join(thumbnailDir, `${asset.id}.webp`);
    await sharp(source)
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(target);
    console.log(`✓ ${asset.id}.webp`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
