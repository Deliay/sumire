/**
 * 从 public/assets/original/ 的原图生成全分辨率 webp（保留透明通道，不缩放）。
 * 输出到 public/assets/original/<id>.webp（供首页立绘等大图 assetOriginalWebpUrl 引用）。
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { parse } from "yaml";
import { z } from "zod";

const assetsSchema = z.array(
  z.object({ id: z.string(), file: z.string() }),
);

async function main() {
  const root = process.cwd();
  const originalDir = path.join(root, "public/assets/original");

  const raw = await readFile(path.join(root, "content/assets.yaml"), "utf8");
  const assets = assetsSchema.parse(parse(raw));

  for (const asset of assets) {
    if (!asset.file.endsWith(".png")) continue;
    const source = path.join(originalDir, asset.file);
    const target = path.join(originalDir, `${asset.id}.webp`);
    await sharp(source).webp({ quality: 85 }).toFile(target);
    console.log(`✓ ${asset.id}.webp`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});