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

  it("ArchiveSection part1 内容列用 bare 变体（无立绘缩略图、无 LaceFrame）", () => {
    render(<ArchiveSection part={1} profile={profile} portraitAssets={portraits} />);
    // ProfilePart bare：不渲染缩略图 <img>（仅左侧大屏立绘一张），且无 LaceFrame
    const imgs = document.querySelectorAll("section img");
    expect(imgs.length).toBe(1); // 仅左侧大屏立绘
    expect(document.querySelector(".lace-x")).toBeNull();
  });

  it("ArchiveSection 单数屏立绘在左、双数屏在右（桌面 order 类）", () => {
    const odd = render(<ArchiveSection part={1} profile={profile} portraitAssets={portraits} />);
    const oddGrid = odd.container.querySelector("section .grid")!;
    // 立绘容器在桌面为第一列（order-1）
    expect(oddGrid.firstElementChild?.className).toContain("lg:order-1");
    odd.unmount();

    const even = render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    const evenGrid = even.container.querySelector("section .grid")!;
    // 双数屏立绘在桌面为第二列（order-2）
    expect(evenGrid.firstElementChild?.className).toContain("lg:order-2");
  });

  it("AssetsSection 含 AssetGallery 与 Footer", () => {
    render(<AssetsSection assets={assets} site={site} />);
    expect(screen.getByText("素材架")).toBeTruthy();
    expect(screen.getByText(assets[0]!.title)).toBeTruthy();
    expect(document.querySelector("footer")).toBeTruthy();
  });

  it("档案各屏立绘均用 standing 立绘（P3 不用插画）且按非相邻循环映射（P1/3/5→01、P2/4→02）", () => {
    // 期望映射：STANDING_CYCLE = [0,1,0,1,0]，即奇数屏 standing-01、偶数屏 standing-02
    const expected = [
      getAssetById("standing-01")!.id,
      getAssetById("standing-02")!.id,
      getAssetById("standing-01")!.id,
      getAssetById("standing-02")!.id,
      getAssetById("standing-01")!.id,
    ];
    for (let part = 1; part <= 5; part++) {
      render(<ArchiveSection part={part} profile={profile} portraitAssets={portraits} />);
      const imgs = document.querySelectorAll("section img");
      // 每屏大屏立绘一张（P1 bare 内容列无缩略图），src 指向 standing 立绘 webp
      expect(imgs.length).toBe(1);
      const src = imgs[0]!.getAttribute("src") ?? "";
      expect(src).toContain("/assets/original/standing-");
      expect(src).not.toContain("illustration");
      expect(src).toContain(expected[part - 1]!);
      cleanup();
    }
  });

  it("档案各屏立绘层外包视差容器（ParallaxLayer）", () => {
    render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    // SplitSection 立绘外包 ParallaxLayer（data-testid=parallax-layer）
    const layer = document.querySelector('[data-testid="parallax-layer"]');
    expect(layer).toBeTruthy();
  });
});