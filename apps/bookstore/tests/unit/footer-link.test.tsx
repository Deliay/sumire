// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

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
  },
};

describe("Footer 管理入口", () => {
  afterEach(() => {
    cleanup();
  });

  it("页脚不渲染任何指向 /backdoor 的链接", () => {
    const { container } = render(<Footer site={site} />);
    expect(screen.queryByRole("link", { name: /管理/ })).toBeNull();
    expect(screen.queryByText("管理 →")).toBeNull();
    expect(container.querySelector('a[href="/backdoor"]')).toBeNull();
  });

  it("单行内容：三外链 href 正确、新窗口、noreferrer", () => {
    render(<Footer site={site} />);
    const bili = screen.getByRole("link", { name: /B 站空间/ });
    const live = screen.getByRole("link", { name: /直播间/ });
    const moegirl = screen.getByRole("link", { name: /萌娘百科/ });
    expect(bili).toHaveAttribute("href", site.links.bilibili);
    expect(live).toHaveAttribute("href", site.links.live);
    expect(moegirl).toHaveAttribute("href", site.links.moegirl);
    for (const link of [bili, live, moegirl]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
      expect(link.getAttribute("rel") ?? "").toContain("noreferrer");
    }
    // 不再有应援色行
    expect(screen.queryByText(/应援色/)).toBeNull();
  });

  it("免责声明带移动端隐藏类（hidden sm:inline）", () => {
    const { container } = render(<Footer site={site} />);
    const disclaimer = container.querySelector("footer span");
    expect(disclaimer?.textContent).toContain("本站为非官方粉丝作品");
    expect(disclaimer?.className).toContain("hidden");
    expect(disclaimer?.className).toContain("sm:inline");
  });

  it("floating 形态仍含三外链且无应援色行", () => {
    const { container } = render(<Footer site={site} floating />);
    expect(screen.getByRole("link", { name: /B 站空间/ })).toHaveAttribute("href", site.links.bilibili);
    expect(container.querySelector('a[href="/backdoor"]')).toBeNull();
  });
});
