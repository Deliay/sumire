"use client";

import { Download, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ASSET_CATEGORY_LABELS,
  assetOriginalUrl,
  assetThumbnailUrl,
} from "@/lib/content/shared";
import type { Asset } from "@/lib/content/shared";

type Filter = Asset["category"] | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "standing", label: "立绘" },
  { value: "illustration", label: "插画" },
  { value: "promo", label: "宣传图" },
];

function Lightbox({
  asset,
  onClose,
}: {
  asset: Asset;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // 经 portal 挂到 body：脱离 transform/overflow 祖先（整页 deck 轨道 will-change:transform 会成为 fixed 包含块并裁剪），确保 fixed 覆盖层以视口为基准可见
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/90 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={assetThumbnailUrl(asset)}
          alt={asset.title}
          width={asset.width}
          height={asset.height}
          className="max-h-[70svh] w-auto max-w-full rounded-lg object-contain"
        />
        <div className="w-full max-w-xl rounded-lg border border-vine/50 bg-raised p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif font-semibold text-ink">{asset.title}</h3>
            <span className="text-xs text-ink-dim">
              {ASSET_CATEGORY_LABELS[asset.category]} · {asset.width} ×{" "}
              {asset.height}
            </span>
          </div>
          {asset.note && (
            <p className="mt-1 text-sm text-ink-dim">{asset.note}</p>
          )}
          <div className="mt-3 flex gap-3">
            <a
              href={assetOriginalUrl(asset)}
              download
              className="inline-flex items-center gap-2 rounded-full border border-flower px-4 py-1.5 text-sm text-ink transition-shadow hover:shadow-[0_0_18px_-2px_var(--color-flower)]"
            >
              <Download size={14} aria-hidden /> 下载原图
            </a>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-full border border-vine px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
            >
              <X size={14} aria-hidden /> 关闭
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 素材画廊：分类筛选 + 网格 + Lightbox。
 */
export default function AssetGallery({ assets }: { assets: Asset[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Asset | null>(null);

  const visible =
    filter === "all"
      ? assets
      : assets.filter((asset) => asset.category === filter);

  return (
    <>
      {/* 分类筛选 */}
      <div className="flex flex-wrap gap-3" role="group" aria-label="素材分类">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              filter === item.value
                ? "bg-primary font-medium text-night"
                : "border border-vine text-ink-dim hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 素材网格 */}
      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => setSelected(asset)}
              className="group block w-full overflow-hidden rounded-lg border border-vine/50 bg-raised text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-flower/70"
            >
              <span className="relative block aspect-[4/5] w-full overflow-hidden bg-soft">
                <Image
                  src={assetThumbnailUrl(asset)}
                  alt={asset.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className={`transition-transform duration-500 group-hover:scale-[1.03] ${
                    asset.category === "standing"
                      ? "object-contain p-4"
                      : "object-cover"
                  }`}
                />
              </span>
              <span className="flex items-baseline justify-between gap-2 p-4">
                <span className="font-serif text-sm font-semibold text-ink">
                  {asset.title}
                </span>
                <span className="shrink-0 text-xs text-ink-dim">
                  {ASSET_CATEGORY_LABELS[asset.category]}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <Lightbox asset={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
