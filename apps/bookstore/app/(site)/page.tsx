import FullpageDeck from "@/features/home/FullpageDeck";
import { getAssetById, getAssets, getProfile, getSite } from "@/lib/content";

export default function Home() {
  const profile = getProfile();
  const site = getSite();
  const assets = getAssets();
  const heroAsset = getAssetById("standing-01");
  if (!heroAsset) throw new Error("missing asset: standing-01");

  const archivePortraits = ["standing-01", "standing-02", "illustration-01"]
    .map((id) => getAssetById(id))
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <FullpageDeck
      profile={profile}
      site={site}
      heroAsset={heroAsset}
      archivePortraits={archivePortraits}
      assets={assets}
    />
  );
}