/**
 * 客户端安全的内容工具：不含 fs 等 Node API，可在 Client Component 中使用。
 */
import type { Asset } from "./schemas";

export type { Asset, AssetCategory } from "./schemas";

export const ASSET_CATEGORY_LABELS: Record<Asset["category"], string> = {
  standing: "立绘",
  illustration: "插画",
  promo: "宣传图",
};

export const assetOriginalUrl = (asset: Asset): string =>
  `/assets/original/${asset.file}`;

export const assetThumbnailUrl = (asset: Asset): string =>
  `/assets/thumbnails/${asset.id}.webp`;
