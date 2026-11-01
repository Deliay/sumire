// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SiteLayout from "@/app/(site)/layout";
import NotFoundPage from "@/components/NotFoundPage";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("site layout 壳层", () => {
  afterEach(() => cleanup());

  it("skip link 为首个可聚焦元素且指向 #main", () => {
    const { container } = render(
      <SiteLayout>
        <div>正文</div>
      </SiteLayout>,
    );
    const firstLink = container.querySelector("a[href]")!;
    expect(firstLink.getAttribute("href")).toBe("#main");
    expect(firstLink.textContent).toBe("跳到正文");
    const main = container.querySelector("main#main");
    expect(main).toBeTruthy();
  });
});

describe("NotFoundPage", () => {
  afterEach(() => cleanup());

  it("404 monitor 文本 aria-hidden + h1 语义 + 返回首页", () => {
    render(<NotFoundPage />);
    const code = screen.getByText("404");
    expect(code.getAttribute("aria-hidden")).toBe("true");
    expect(code.className).toContain("font-mono");
    expect(screen.getByRole("heading", { level: 1, name: "页面不存在" })).toBeTruthy();
    const back = screen.getByRole("link", { name: "返回首页" });
    expect(back.getAttribute("href")).toBe("/");
  });

  it("无内联径向渐变", () => {
    const { container } = render(<NotFoundPage />);
    expect(container.innerHTML).not.toContain("radial-gradient");
    expect(container.innerHTML).not.toContain("rgb(139 95 214");
  });
});
