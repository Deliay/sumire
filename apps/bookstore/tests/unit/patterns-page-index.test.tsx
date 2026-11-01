// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import PageIndex from "@/features/home/PageIndex";
import { visibleSections } from "@/features/home/sections";

function mockMatchMedia(matches: boolean) {
  return {
    matches,
    media: "",
    addEventListener() {},
    removeEventListener() {},
  };
}

describe("PageIndex", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => mockMatchMedia(false));
  });

  it("渲染中文页码与当前项 aria-current", () => {
    render(<PageIndex sections={visibleSections(true)} index={2} onNavigate={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "页面位置" });
    expect(nav.textContent).toContain("壹");
    expect(nav.textContent).toContain("捌");
    expect(screen.getByRole("link", { name: "档案 · 设定" }).getAttribute("aria-current")).toBe("true");
  });

  it("点击回调索引", () => {
    const onNavigate = vi.fn();
    render(<PageIndex sections={visibleSections(true)} index={0} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "素材" }));
    expect(onNavigate).toHaveBeenCalledWith(7);
  });

  it("1023px 以下不渲染", () => {
    vi.stubGlobal("matchMedia", () => mockMatchMedia(true));
    render(<PageIndex sections={visibleSections(true)} index={0} onNavigate={() => {}} />);
    expect(screen.queryByRole("navigation", { name: "页面位置" })).toBeNull();
  });

  it("未配置 API 时日历缺席且页码不跳号", () => {
    render(<PageIndex sections={visibleSections(false)} index={0} onNavigate={() => {}} />);
    const nav = screen.getByRole("navigation", { name: "页面位置" });
    expect(nav.textContent).not.toContain("日历");
    expect(nav.textContent).toContain("柒");
  });
});
