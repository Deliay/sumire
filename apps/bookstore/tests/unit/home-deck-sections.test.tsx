// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
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

describe("首页屏组件（装订版）", () => {
  afterEach(() => cleanup());

  it("HeroSection：竖排书名 + 图版 + 免责声明，无 Footer / 无雾气视差", () => {
    render(<HeroSection profile={profile} site={site} heroAsset={hero} />);
    expect(screen.getByText("枝堇")).toBeTruthy();
    expect(screen.getByText("Sumire")).toBeTruthy();
    expect(screen.getByText(site.disclaimer)).toBeTruthy();
    expect(document.querySelector("footer")).toBeNull();
    expect(document.querySelector(".fog")).toBeNull();
    expect(document.querySelector("[data-testid='parallax-layer']")).toBeNull();
    expect(document.querySelector("[aria-hidden][class*='radial-gradient']")).toBeNull();
    // 桌面竖排 / 移动横排
    const title = screen.getByText("枝堇");
    expect(title.className).toContain("lg:[writing-mode:vertical-rl]");
    // 图版 figure + figcaption
    expect(document.querySelector("figure figcaption")?.textContent).toContain("图版 01");
  });

  it("ArchiveSection part1 使用 bare 变体（无信息卡缩略图）与 SectionHeader", () => {
    render(<ArchiveSection part={1} profile={profile} portraitAssets={portraits} />);
    expect(screen.getByRole("heading", { level: 2, name: "信息" })).toBeTruthy();
    expect(screen.getByText("本名")).toBeTruthy();
    // 仅一张大屏图版，不含 thumbnails 缩略图
    const imgs = document.querySelectorAll("section img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("src") ?? "").not.toContain("/thumbnails/");
    expect(document.querySelector("." + "lace" + "-x")).toBeNull();
  });

  it("档案五屏固定阅读轴：文字左 6 列、图版右 5 列（col-start-8）", () => {
    for (const part of [1, 2, 5]) {
      render(<ArchiveSection part={part} profile={profile} portraitAssets={portraits} />);
      const grid = document.querySelector("section .grid")!;
      const [first, second] = Array.from(grid.children) as HTMLElement[];
      expect(first!.className).toContain("lg:col-span-6");
      expect(second!.className).toContain("lg:col-span-5");
      expect(second!.className).toContain("lg:col-start-8");
      cleanup();
    }
  });

  it("档案各屏立绘按持书/非持书错位 cycle（P1/P3/P5→02、P2/P4→01），只用 standing", () => {
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
      expect(imgs).toHaveLength(1);
      const src = imgs[0]!.getAttribute("src") ?? "";
      expect(src).toContain("/assets/original/standing-");
      expect(src).toContain(expected[part - 1]!);
      cleanup();
    }
  });

  it("图版题注存在（figure/figcaption），无圆角与阴影类", () => {
    render(<ArchiveSection part={2} profile={profile} portraitAssets={portraits} />);
    const figure = document.querySelector("figure")!;
    expect(figure).toBeTruthy();
    expect(figure.querySelector("figcaption")?.textContent).toContain("立绘");
    expect(figure.innerHTML).not.toContain("rounded-lg");
    expect(figure.innerHTML).not.toContain("shadow");
  });

  it("P4 历程桌面端内容溢出时初始锚定底部（默认可见最新条目）", () => {
    const { container } = render(<ArchiveSection part={4} profile={profile} portraitAssets={portraits} />);
    const scroller = container.querySelector("[data-fullpage-scrollable]") as HTMLElement;
    expect(scroller).toBeTruthy();
    let scrollTop = 0;
    Object.defineProperty(scroller, "clientHeight", { value: 600, configurable: true });
    Object.defineProperty(scroller, "scrollHeight", { value: 1200, configurable: true });
    Object.defineProperty(scroller, "scrollTop", {
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = v;
      },
      configurable: true,
    });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(scrollTop).toBe(1200);
  });

  it("AssetsSection 含素材图版网格与 Footer", () => {
    render(<AssetsSection assets={assets} site={site} />);
    expect(screen.getByRole("heading", { level: 2, name: "素材架" })).toBeTruthy();
    expect(screen.getByText(new RegExp(assets[0]!.title))).toBeTruthy();
    expect(document.querySelector("footer")).toBeTruthy();
  });
});
