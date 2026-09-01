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
    // ProfilePart bare：内容列不渲染缩略图 <img>；全 section 仅桌面错位大屏立绘 + 移动端 hero 口径背景立绘各一张
    const imgs = document.querySelectorAll("section img");
    expect(imgs.length).toBe(2);
    for (const img of Array.from(imgs)) {
      expect(img.getAttribute("src") ?? "").not.toContain("/thumbnails/");
    }
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

  it("档案各屏立绘均用 standing 立绘（P3 不用插画）且按「持书/非持书」错位映射（奇数屏非持书→02、偶数屏持书→01，避开首页同款持书 standing-01）；移动端 hero 口径背景立绘与桌面同 cycle 交替", () => {
    // 期望映射：STANDING_CYCLE = [1,0,1,0,1]，即奇数屏 standing-02、偶数屏 standing-01（桌面错位立绘与移动端背景立绘共用）
    const expected = [
      getAssetById("standing-02")!.id,
      getAssetById("standing-01")!.id,
      getAssetById("standing-02")!.id,
      getAssetById("standing-01")!.id,
      getAssetById("standing-02")!.id,
    ];
    for (let part = 1; part <= 5; part++) {
      render(<ArchiveSection part={part} profile={profile} portraitAssets={portraits} />);
      const imgs = Array.from(document.querySelectorAll("section img"));
      // 桌面错位大屏立绘（grid 分栏内）+ 移动端 hero 口径背景立绘 各一张
      expect(imgs.length).toBe(2);
      const big = Array.from(document.querySelectorAll("section .grid img"));
      expect(big.length).toBe(1);
      const src = big[0]!.getAttribute("src") ?? "";
      expect(src).toContain("/assets/original/standing-");
      expect(src).not.toContain("illustration");
      expect(src).toContain(expected[part - 1]!);
      // 移动端 hero 口径背景立绘（grid 外的背景层）按同一 cycle 交替
      const bg = imgs.filter((img) => !img.closest(".grid"));
      expect(bg.length).toBe(1);
      const bgSrc = bg[0]!.getAttribute("src") ?? "";
      expect(bgSrc).toContain(expected[part - 1]!);
      cleanup();
    }
  });

  it("档案各屏立绘层外包视差容器（ParallaxLayer）", () => {
    render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    // SplitSection 立绘外包 ParallaxLayer（data-testid=parallax-layer）
    const layer = document.querySelector('[data-testid="parallax-layer"]') as HTMLElement;
    expect(layer).toBeTruthy();
  });

  it("移动端内容浮层带毛玻璃底且铺满整屏（仅移动端，桌面 lg 复位透明）", () => {
    render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    // 内容列内浮层（data-fullpage-scrollable 的直接子 div）须带毛玻璃底且至少铺满整列高度，桌面复位
    const float = document.querySelector('[data-fullpage-scrollable] > div') as HTMLElement;
    expect(float).toBeTruthy();
    expect(float.className).toContain("backdrop-blur-md");
    expect(float.className).toContain("bg-night/70");
    // 铺满整屏：min-h-full ≥ 内容列高度（内容短时模糊仍盖满全屏）
    expect(float.className).toContain("min-h-full");
    // 桌面复位：lg 下透明、无毛玻璃、无移动端 padding、min-h 复位
    expect(float.className).toContain("lg:bg-transparent");
    expect(float.className).toContain("lg:backdrop-blur-none");
    expect(float.className).toContain("lg:p-0");
    expect(float.className).toContain("lg:min-h-0");
  });

  it("档案立绘层较裁剪容器四周外扩 PARALLAX_MAX 余量（视差最大位移不露底边截断）", () => {
    render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    // 裁剪容器 = 立绘列内 overflow-hidden 的 relative 盒子
    const layer = document.querySelector('[data-testid="parallax-layer"]') as HTMLElement;
    const clip = layer.parentElement as HTMLElement;
    expect(clip.className).toContain("overflow-hidden");
    expect(clip.className).toContain("relative");
    // 立绘层须 absolute 且四周外扩（-inset-*），保证 ±PARALLAX_MAX 位移时边缘不外露
    expect(layer.className).toContain("absolute");
    expect(layer.className).toContain("-inset-x-3");
    expect(layer.className).toContain("-inset-y-3");
  });
});