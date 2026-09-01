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

describe("AssetGallery 全幅化", () => {
  afterEach(() => cleanup());

  it("渲染网格含扩展断点列类（xl:grid-cols-4）", () => {
    render(<AssetGallery assets={assets} />);
    const grid = document.querySelector("ul.grid");
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain("xl:grid-cols-4");
  });

  it("默认展示全部素材", () => {
    render(<AssetGallery assets={assets} />);
    expect(screen.getByText("立绘A")).toBeTruthy();
    expect(screen.getByText("插画B")).toBeTruthy();
    expect(screen.getByText("宣传D")).toBeTruthy();
  });

  it("分类筛选口径不变", () => {
    render(<AssetGallery assets={assets} />);
    fireEvent.click(screen.getByRole("button", { name: "立绘" }));
    expect(screen.getByText("立绘A")).toBeTruthy();
    expect(screen.getByText("立绘C")).toBeTruthy();
    expect(screen.queryByText("插画B")).toBeNull();
  });

  it("Lightbox 打开关闭回归", () => {
    render(<AssetGallery assets={assets} />);
    fireEvent.click(screen.getByText("立绘A"));
    expect(screen.getByRole("dialog", { name: "立绘A" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});