// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import AssetGallery from "@/features/assets/AssetGallery";
import type { Asset } from "@/lib/content/shared";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt} />;
  },
}));

const assets: Asset[] = [
  { id: "a1", title: "立绘A", category: "standing", file: "a1.png", width: 500, height: 1000 },
  { id: "a2", title: "插画B", category: "illustration", file: "a2.png", width: 1000, height: 1000 },
  { id: "a3", title: "立绘C", category: "standing", file: "a3.png", width: 500, height: 1000 },
  { id: "a4", title: "宣传D", category: "promo", file: "a4.png", width: 1000, height: 500 },
];

describe("AssetGallery 图版网格", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("渲染图版网格（1/2/3/4 列）", () => {
    render(<AssetGallery assets={assets} />);
    const grid = document.querySelector("ul.grid");
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain("xl:grid-cols-4");
    expect(grid!.className).toContain("sm:grid-cols-2");
    expect(grid!.className).toContain("lg:grid-cols-3");
  });

  it("默认展示全部素材（图版题注含编号）", () => {
    render(<AssetGallery assets={assets} />);
    expect(screen.getByText(/立绘A/)).toBeTruthy();
    expect(screen.getByText(/插画B/)).toBeTruthy();
    expect(screen.getByText(/宣传D/)).toBeTruthy();
    expect(screen.getAllByText(/图版 0[1-4]/).length).toBe(4);
  });

  it("分类筛选改为下划线 tab 且口径不变", () => {
    render(<AssetGallery assets={assets} />);
    const tab = screen.getByRole("button", { name: "立绘" });
    expect(tab.className).toContain("min-h-11");
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/立绘A/)).toBeTruthy();
    expect(screen.getByText(/立绘C/)).toBeTruthy();
    expect(screen.queryByText(/插画B/)).toBeNull();
  });

  it("Lightbox 打开关闭回归 + 锁定滚动", () => {
    render(<AssetGallery assets={assets} />);
    fireEvent.click(screen.getByText(/立绘A/));
    expect(screen.getByRole("dialog", { name: "立绘A" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("Lightbox 内 Tab 首尾循环", () => {
    render(<AssetGallery assets={assets} />);
    fireEvent.click(screen.getByText(/立绘A/));
    const dialog = screen.getByRole("dialog", { name: "立绘A" });
    const links = Array.from(dialog.querySelectorAll<HTMLElement>("a, button"));
    const last = links[links.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(links[0]);
  });

  it("空分类渲染统一空态", () => {
    render(<AssetGallery assets={[assets[0]!]} />);
    fireEvent.click(screen.getByRole("button", { name: "宣传图" }));
    expect(screen.getByText("暂无素材")).toBeTruthy();
  });
});
