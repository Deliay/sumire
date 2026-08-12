// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

const site = {
  name: "堇色书屋",
  tagline: "枝堇Sumire 非官方应援站",
  description: "站点描述",
  disclaimer: "免责声明",
  color: "#b4a6bf",
  links: {
    bilibili: "https://example.com/b",
    live: "https://example.com/l",
    moegirl: "https://example.com/m",
  },
};

describe("Footer 管理入口", () => {
  it("右下角渲染「管理 →」链接指向 /backdoor", () => {
    render(<Footer site={site} />);
    const link = screen.getByText("管理 →");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/backdoor");
  });
});
