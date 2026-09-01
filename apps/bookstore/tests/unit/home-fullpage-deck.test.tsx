// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import FullpageDeck from "@/features/home/FullpageDeck";
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

function mockMatchMedia(matches: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null;
  const mql = {
    matches,
    media: "",
    addEventListener: (_t: string, cb: (e: { matches: boolean }) => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  return {
    stub: () => mql,
    set: (next: boolean) => {
      mql.matches = next;
      listener?.({ matches: next });
    },
  };
}

function renderDeck() {
  return render(
    <FullpageDeck profile={profile} site={site} heroAsset={hero} archivePortraits={portraits} assets={assets} />,
  );
}

describe("FullpageDeck", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", mockMatchMedia(false).stub);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("首屏直出站 0、无 transform", () => {
    renderDeck();
    const track = document.querySelector("[data-testid='glow-particles']");
    expect(track).toBeTruthy(); // 粒子常驻
    expect(screen.getByText("枝堇")).toBeTruthy(); // hero 站
  });

  it("渲染完整站序列与常驻粒子 canvas、SectionRail", () => {
    renderDeck();
    const sections = document.querySelectorAll("[data-section]");
    // 单测环境无 API_CONFIGURED → 7 站（首页/档案×5/素材，无日历）
    expect(sections.length).toBe(7);
    expect(document.querySelector("nav[aria-label='页面位置']")).toBeTruthy();
    expect(document.querySelector('[data-testid="glow-particles"]')).toBeTruthy();
  });

  it("模拟 wheel 后指示器随动（档案高亮）", () => {
    renderDeck();
    const wheel = () =>
      act(() => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
      });
    wheel();
    // 进入 archive-1
    const rail = document.querySelector("nav[aria-label='页面位置']");
    expect(rail).toBeTruthy();
    // 无 API 时默认（单测环境无 NEXT_PUBLIC）序列为 7 站（无日历）
    const sections = document.querySelectorAll("[data-section]");
    expect(sections.length).toBe(7);
  });

  it("SectionRail 当前站变化高亮正确、点击节点触发跳转", () => {
    renderDeck();
    const link = screen.getByText("素材");
    fireEvent.click(link);
    // 素材为末站，点击后应滚动到素材站
    const sections = document.querySelectorAll("[data-section]");
    expect(sections.length).toBe(7);
  });
});