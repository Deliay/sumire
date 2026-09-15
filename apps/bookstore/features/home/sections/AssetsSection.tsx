"use client";

import Footer from "@/components/Footer";
import AssetGallery from "@/features/assets/AssetGallery";
import type { Asset, Site } from "@/lib/content";

/** 素材站：全幅素材网格 + 流式单 Footer（全站唯一 Footer，尾部自然滚动）。 */
export default function AssetsSection({
  assets,
  site,
}: {
  assets: Asset[];
  site: Site;
}) {
  return (
    <section className="flex min-h-svh flex-col px-5 pb-6 pt-20 lg:px-10 lg:py-6">
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">素材架</h2>
      <div className="mt-6">
        <AssetGallery assets={assets} />
      </div>
      <div className="mt-10">
        <Footer site={site} />
      </div>
    </section>
  );
}