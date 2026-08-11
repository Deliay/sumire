/**
 * 客户端安全的内容工具：不含 fs 等 Node API，可在 Client Component 中使用。
 */
import type { Asset } from "./schemas";

export type { Asset, AssetCategory } from "./schemas";

/**
 * 部署子路径前缀（GitHub Pages 项目站点为 /<repo>）。
 * 构建期注入，本地为空串。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const ASSET_CATEGORY_LABELS: Record<Asset["category"], string> = {
  standing: "立绘",
  illustration: "插画",
  promo: "宣传图",
};

export const assetOriginalUrl = (asset: Asset): string =>
  `${BASE_PATH}/assets/original/${asset.file}`;

export const assetThumbnailUrl = (asset: Asset): string =>
  `${BASE_PATH}/assets/thumbnails/${asset.id}.webp`;
