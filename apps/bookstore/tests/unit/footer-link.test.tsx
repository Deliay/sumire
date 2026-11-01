// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

vi.mock("@/features/backdoor/api", () => ({ API_CONFIGURED: true }));
vi.mock("@/features/recordings/api", () => ({ RECORDINGS_CONFIGURED: true }));

const site = {
  name: "堇色书屋",
  tagline: "枝堇Sumire 非官方应援站",
  description: "站点描述",
  disclaimer: "本站为非官方粉丝作品，与 VirtuaReal 及主播本人无关；站内素材版权归枝堇Sumire 及 VirtuaReal 所有，请勿用于商业用途。",
  color: "#b4a6bf",
  links: {
    bilibili: "https://example.com/b",
    live: "https://example.com/l",
    moegirl: "https://example.com/m",
    secretRoom: "https://sumire.icu",
  },
};

describe("Footer 版权页", () => {
  afterEach(() => {
    cleanup();
  });

  it("页脚不渲染任何指向 /backdoor 的链接", () => {
    const { container } = render(<Footer site={site} />);
    expect(screen.queryByRole("link", { name: /管理/ })).toBeNull();
    expect(container.querySelector('a[href="/backdoor"]')).toBeNull();
  });

  it("三栏结构：站点说明 / 导航 / 关注，顶部 1px 线且无蕾丝与 raised 条", () => {
    const { container } = render(<Footer site={site} />);
    const footer = container.querySelector("footer")!;
    expect(footer.className).toContain("border-t");
    expect(footer.className).toContain("border-line");
    expect(container.querySelector("." + "lace" + "-x")).toBeNull();
    expect(container.innerHTML).not.toContain("bg-raised");
    expect(container.querySelector(".grid")!.className).toContain("sm:grid-cols-3");
    expect(screen.getByRole("navigation", { name: "页脚导航" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "官方链接" })).toBeTruthy();
  });

  it("六个站点链接（按门控过滤）", () => {
    render(<Footer site={site} />);
    const nav = screen.getByRole("navigation", { name: "页脚导航" });
    for (const label of ["主页", "档案", "素材", "日历", "录播", "棉花糖"]) {
      expect(nav.textContent).toContain(label);
    }
  });

  it("四个外链：href 正确、新窗口、noopener/noreferrer、图标 aria-hidden", () => {
    render(<Footer site={site} />);
    const bili = screen.getByRole("link", { name: /B 站空间/ });
    const live = screen.getByRole("link", { name: /直播间/ });
    const moegirl = screen.getByRole("link", { name: /萌娘百科/ });
    const secret = screen.getByRole("link", { name: /小密室/ });
    expect(bili).toHaveAttribute("href", site.links.bilibili);
    expect(live).toHaveAttribute("href", site.links.live);
    expect(moegirl).toHaveAttribute("href", site.links.moegirl);
    expect(secret).toHaveAttribute("href", site.links.secretRoom);
    for (const link of [bili, live, moegirl, secret]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
      expect(link.getAttribute("rel") ?? "").toContain("noreferrer");
      expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("免责声明完整展示、不截断，并展示应援色", () => {
    render(<Footer site={site} />);
    expect(screen.getByText(site.disclaimer)).toBeTruthy();
    expect(screen.getByText(/应援色 #b4a6bf/)).toBeTruthy();
  });
});
