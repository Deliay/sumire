"use client";

import Footer from "@/components/Footer";
import SectionHeader from "@/components/layout/SectionHeader";
import AssetGallery from "@/features/assets/AssetGallery";
import type { Asset, Site } from "@/lib/content";

/** 素材站：图版网格 + 版权页式 Footer（全站唯一 Footer，尾部自然滚动）。 */
export default function AssetsSection({
  assets,
  site,
}: {
  assets: Asset[];
  site: Site;
}) {
  return (
    <section className="flex min-h-svh flex-col px-5 pb-6 pt-24 lg:px-16 lg:pt-28">
      <SectionHeader eyebrow="Assets" folio="捌" title="素材架" lead="官方立绘、插画与宣传图。图版版权归主播及所属社团所有。" />
      <div className="mt-8">
        <AssetGallery assets={assets} />
      </div>
      <div className="mt-12">
        <Footer site={site} />
      </div>
    </section>
  );
}
