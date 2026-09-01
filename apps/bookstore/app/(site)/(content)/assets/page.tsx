import PaperCard from "@/components/PaperCard";
import AssetGallery from "@/features/assets/AssetGallery";
import { getAssets, getSite } from "@/lib/content";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "周边素材" };

export default function AssetsPage() {
  const assets = getAssets();
  const site = getSite();

  return (
    <div className="mx-auto w-full px-5 pt-28 lg:px-10">
      <header className="flex flex-col gap-2">
        <span className="font-display text-sm italic tracking-[0.35em] text-ink-dim">
          Assets
        </span>
        <h1 className="font-serif text-4xl font-bold tracking-wider">
          素材架
        </h1>
      </header>

      <PaperCard corners={false} className="mt-8 !p-5">
        <p className="text-sm leading-relaxed">{site.disclaimer}</p>
      </PaperCard>

      <div className="mt-10">
        <AssetGallery assets={assets} />
      </div>
    </div>
  );
}
