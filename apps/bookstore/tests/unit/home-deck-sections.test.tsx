// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HeroSection from "@/features/home/sections/HeroSection";
import ArchiveSection from "@/features/home/sections/ArchiveSection";
import AssetsSection from "@/features/home/sections/AssetsSection";
import { getProfile, getSite, getAssets, getAssetById } from "@/lib/content";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt} />;
  },
}));

const profile = getProfile();
const site = getSite();
const assets = getAssets();
const hero = getAssetById("standing-01")!;
const portraits = [getAssetById("standing-01")!, getAssetById("standing-02")!, getAssetById("illustration-01")!];

describe("首页屏组件", () => {
  afterEach(() => cleanup());

  it("HeroSection 渲染文案块与立绘层、无 Footer floating", () => {
    render(<HeroSection profile={profile} site={site} heroAsset={hero} />);
    expect(screen.getByText("枝堇")).toBeTruthy();
    expect(screen.getByText("Sumire")).toBeTruthy();
    expect(screen.getByText(site.disclaimer)).toBeTruthy();
    expect(document.querySelector("footer")).toBeNull();
  });

  it("ArchiveSection part1 渲染 ProfilePart（含本名）", () => {
    render(<ArchiveSection part={1} profile={profile} portraitAssets={portraits} />);
    expect(screen.getByText("本名")).toBeTruthy();
    expect(screen.getByText(profile.displayName)).toBeTruthy();
  });

  it("ArchiveSection 单数屏立绘在左、双数屏在右（order 类）", () => {
    const odd = render(<ArchiveSection part={1} profile={profile} portraitAssets={portraits} />);
    const oddGrid = odd.container.querySelector("section .grid")!;
    expect(oddGrid.firstElementChild?.className).toContain("hidden lg:block");
    odd.unmount();

    const even = render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    const evenGrid = even.container.querySelector("section .grid")!;
    expect(evenGrid.lastElementChild?.className).toContain("hidden lg:block");
  });

  it("AssetsSection 含 AssetGallery 与 Footer", () => {
    render(<AssetsSection assets={assets} site={site} />);
    expect(screen.getByText("素材架")).toBeTruthy();
    expect(screen.getByText(assets[0]!.title)).toBeTruthy();
    expect(document.querySelector("footer")).toBeTruthy();
  });
});