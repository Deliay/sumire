// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Sender from "@/features/danmaku/components/Sender";
import type { LiveEvent } from "@/features/danmaku/types";

const BASE_SENDER: LiveEvent["sender"] = {
  uid: 672353429,
  name: "测试观众",
  face: "https://i0.hdslb.com/face.jpg",
  medal: { name: "堇粉丝", level: 21, color: "#8b5fd6" },
};

describe("Sender 公共组件", () => {
  afterEach(() => {
    cleanup();
  });

  it("渲染头像 img / 昵称 / 牌子（按牌子颜色渲染）", () => {
    const { container } = render(<Sender sender={BASE_SENDER} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(BASE_SENDER.face);
    expect(screen.getByText("测试观众")).toBeTruthy();
    const medal = screen.getByText(/堇粉丝/);
    expect(medal.textContent).toContain("21");
    expect(medal.getAttribute("style")).toContain("rgb(139, 95, 214)");
  });

  it("缺头像（face=null）时渲染兜底首字，不渲染 img", () => {
    const { container } = render(<Sender sender={{ ...BASE_SENDER, face: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("测")).toBeTruthy();
  });

  it("无牌子（medal=null）时不渲染牌子", () => {
    render(<Sender sender={{ ...BASE_SENDER, medal: null }} />);
    expect(screen.getByText("测试观众")).toBeTruthy();
    expect(screen.queryByText(/堇粉丝/)).toBeNull();
  });

  it("点击新开 B 站空间 https://space.bilibili.com/{uid}", () => {
    const { container } = render(<Sender sender={BASE_SENDER} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://space.bilibili.com/672353429");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });
});
