import type { Metadata } from "next";
import PageHeader from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";
import Notice from "@/components/ui/Notice";
import AssetGallery from "@/features/assets/AssetGallery";
import { getAssets, getSite } from "@/lib/content";

export const metadata: Metadata = { title: "周边素材" };

export default function AssetsPage() {
  const assets = getAssets();
  const site = getSite();

  return (
    <PageShell width="wide">
      <PageHeader eyebrow="Assets" folio="捌" title="素材架" />

      <Notice className="mt-8">{site.disclaimer}</Notice>

      <div className="mt-10">
        <AssetGallery assets={assets} />
      </div>
    </PageShell>
  );
}
