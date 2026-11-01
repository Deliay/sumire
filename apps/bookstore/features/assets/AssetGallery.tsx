"use client";

import { Download, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Plate from "@/components/ui/Plate";
import Surface from "@/components/ui/Surface";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cn } from "@/lib/cn";
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

function Lightbox({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, { lockScroll: true, onEscape: onClose });

  // 经 portal 挂到 body：脱离 transform/overflow 祖先（整页 deck 轨道 will-change:transform 会成为 fixed 包含块并裁剪）
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/96 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <Image
          src={assetThumbnailUrl(asset)}
          alt={asset.title}
          width={asset.width}
          height={asset.height}
          className="max-h-[70svh] w-auto max-w-full border border-line bg-soft object-contain"
        />
        <Surface padding="sm" className="w-full">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-h3 font-semibold text-ink">{asset.title}</h3>
            <span className="font-mono text-label text-ink-dim">
              {ASSET_CATEGORY_LABELS[asset.category]} · {asset.width} × {asset.height}
            </span>
          </div>
          {asset.note ? <p className="mt-1 text-small text-ink-dim">{asset.note}</p> : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              href={assetOriginalUrl(asset)}
              download
              variant="primary"
              size="sm"
              icon={<Download size={14} />}
            >
              下载原图
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} icon={<X size={14} />}>
              关闭
            </Button>
          </div>
        </Surface>
      </div>
    </div>,
    document.body,
  );
}

/** 素材画廊：下划线分类 tab + 图版网格 + Lightbox（焦点陷阱）。 */
export default function AssetGallery({ assets }: { assets: Asset[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Asset | null>(null);

  const visible =
    filter === "all" ? assets : assets.filter((asset) => asset.category === filter);

  return (
    <>
      <div className="flex flex-wrap gap-6 border-b border-line" role="group" aria-label="素材分类">
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={active}
              className={cn(
                "min-h-11 border-b-2 pb-2 text-small transition-colors duration-(--duration-fast)",
                active
                  ? "border-primary text-ink"
                  : "border-transparent text-ink-dim hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState className="mt-8" title="暂无素材" description="这个分类下还没有可展示的图版。" />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((asset, index) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setSelected(asset)}
                className="group block w-full text-left transition-opacity duration-(--duration-fast) hover:opacity-90"
              >
                <Plate
                  as="div"
                  src={assetThumbnailUrl(asset)}
                  alt={asset.title}
                  width={asset.width}
                  height={asset.height}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  fit={asset.category === "standing" ? "contain" : "cover"}
                  index={index + 1}
                  caption={`${asset.title} · ${ASSET_CATEGORY_LABELS[asset.category]}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? <Lightbox asset={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
