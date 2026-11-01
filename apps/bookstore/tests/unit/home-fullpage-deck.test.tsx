// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, act, within } from "@testing-library/react";
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

describe("FullpageDeck（装订版）", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", mockMatchMedia(false).stub);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("首屏直出站 0、无 transform、无粒子 canvas", () => {
    renderDeck();
    expect(document.querySelector("canvas")).toBeNull();
    expect(screen.getByText("枝堇")).toBeTruthy();
  });

  it("渲染完整站序列与右侧页码索引（中文页码）", () => {
    renderDeck();
    const sections = document.querySelectorAll("[data-section]");
    expect(sections.length).toBe(7);
    const nav = document.querySelector("nav[aria-label='页面位置']");
    expect(nav).toBeTruthy();
    expect(nav!.textContent).toContain("壹");
    expect(nav!.textContent).toContain("贰");
    expect(nav!.textContent).toContain("柒");
  });

  it("移动端进度条存在（1px line-strong、aria-hidden）", () => {
    renderDeck();
    const progress = document.querySelector(".bg-line-strong.h-px");
    expect(progress).toBeTruthy();
    expect(progress!.getAttribute("aria-hidden")).toBe("true");
  });

  it("PageIndex 当前项 aria-current 标注，点击页码触发跳转", () => {
    renderDeck();
    const nav = screen.getByRole("navigation", { name: "页面位置" });
    const link = within(nav).getByRole("link", { name: "素材" });
    expect(link.getAttribute("aria-current")).toBeNull();
    fireEvent.click(link);
    expect(within(screen.getByRole("navigation", { name: "页面位置" })).getByRole("link", { name: "素材" }).getAttribute("aria-current")).toBe("true");
    const sections = document.querySelectorAll("[data-section]");
    expect(sections.length).toBe(7);
  });

  it("模拟 wheel 翻页后索引随动", () => {
    renderDeck();
    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    const nav = screen.getByRole("navigation", { name: "页面位置" });
    expect(within(nav).getByRole("link", { name: "档案 · 信息" }).getAttribute("aria-current")).toBe("true");
  });
});
