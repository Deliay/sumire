// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Sender from "@/features/danmaku/components/Sender";
import type { LiveEvent } from "@/features/danmaku/types";

const BASE_SENDER: LiveEvent["sender"] = {
  uid: 672353429,
  name: "测试观众",
  nameRomaji: null,
  face: "https://i0.hdslb.com/face.jpg",
  medal: { name: "堇粉丝", level: 21, color: "#8b5fd6" },
  guardLevel: null,
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
    expect(medal.getAttribute("style")).toContain("rgb(139, 95, 214)"); // 背景色为牌子色
    expect(medal.getAttribute("style")).toContain("rgb(255, 255, 255)"); // 文字白色
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

  it("有 nameRomaji 时另起一行展示罗马音", () => {
    render(<Sender sender={{ ...BASE_SENDER, nameRomaji: "hakkatou" }} />);
    expect(screen.getByText("测试观众")).toBeTruthy();
    expect(screen.getByText("hakkatou")).toBeTruthy();
  });

  it("nameRomaji 为 null 时仅展示名字，不渲染罗马音", () => {
    render(<Sender sender={{ ...BASE_SENDER, nameRomaji: null }} />);
    expect(screen.getByText("测试观众")).toBeTruthy();
    expect(screen.queryByText("hakkatou")).toBeNull();
  });

  it("guardLevel 为 null 时不渲染船员标识，也无挂件图", () => {
    render(<Sender sender={BASE_SENDER} />);
    expect(screen.queryByText(/舰长|提督|总督/)).toBeNull();
    expect(document.querySelector('[src*="guard-badge"]')).toBeNull();
  });

  it("guardLevel=3 渲染「舰长」标识，=2 渲染「提督」，=1 渲染「总督」", () => {
    const { rerender } = render(<Sender sender={{ ...BASE_SENDER, guardLevel: 3 }} />);
    expect(screen.getByText("舰长")).toBeTruthy();
    rerender(<Sender sender={{ ...BASE_SENDER, guardLevel: 2 }} />);
    expect(screen.getByText("提督")).toBeTruthy();
    rerender(<Sender sender={{ ...BASE_SENDER, guardLevel: 1 }} />);
    expect(screen.getByText("总督")).toBeTruthy();
  });

  it("头像右下角渲染船型挂件：3/2/1 → 舰长/提督/总督素材", () => {
    const { rerender } = render(<Sender sender={{ ...BASE_SENDER, guardLevel: 3 }} />);
    expect(document.querySelector('[src*="guard-badge-captain"]')).toBeTruthy();
    rerender(<Sender sender={{ ...BASE_SENDER, guardLevel: 2 }} />);
    expect(document.querySelector('[src*="guard-badge-admiral"]')).toBeTruthy();
    rerender(<Sender sender={{ ...BASE_SENDER, guardLevel: 1 }} />);
    expect(document.querySelector('[src*="guard-badge-governor"]')).toBeTruthy();
  });

  it("缺头像（face=null）兜底首字时仍渲染挂件", () => {
    render(<Sender sender={{ ...BASE_SENDER, face: null, guardLevel: 3 }} />);
    expect(screen.getByText("测")).toBeTruthy();
    expect(document.querySelector('[src*="guard-badge-captain"]')).toBeTruthy();
  });

  it("guardLevel 覆盖：sender.guardLevel=null 时按传入等级渲染挂件", () => {
    render(<Sender sender={BASE_SENDER} guardLevel={3} />);
    expect(document.querySelector('[src*="guard-badge-captain"]')).toBeTruthy();
  });

  it("点击新开 B 站空间 https://space.bilibili.com/{uid}", () => {
    const { container } = render(<Sender sender={BASE_SENDER} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://space.bilibili.com/672353429");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("点击/双击头像昵称链接不冒泡到父级（避免误触已读切换）", () => {
    const onParentClick = vi.fn();
    const onParentDoubleClick = vi.fn();
    const { container } = render(
      <div onClick={onParentClick} onDoubleClick={onParentDoubleClick}>
        <Sender sender={BASE_SENDER} />
      </div>,
    );
    const link = container.querySelector("a") as HTMLAnchorElement;
    fireEvent.click(link);
    fireEvent.doubleClick(link);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(onParentDoubleClick).not.toHaveBeenCalled();
  });

  describe("Sender variant 属性", () => {
    const FULL_SENDER: LiveEvent["sender"] = {
      uid: 12345,
      name: "测试用户",
      nameRomaji: "tesuto",
      face: "https://i0.hdslb.com/face.jpg",
      medal: { name: "堇色信笺", level: 10, color: "#8b5fd6" },
      guardLevel: 3,
    };

    it("variant='full'（默认）展示完整信息：头像+昵称+牌子+船型标签+罗马音", () => {
      render(<Sender sender={FULL_SENDER} />);
      expect(screen.getByText("测试用户")).toBeTruthy();
      expect(screen.getByText("tesuto")).toBeTruthy();
      expect(screen.getByText(/堇色信笺/)).toBeTruthy();
      expect(screen.getByText("舰长")).toBeTruthy();
      expect(document.querySelector('[src*="guard-badge-captain"]')).toBeTruthy();
    });

    it("variant='avatar-name' 仅展示头像+昵称，隐藏牌子/船型标签/罗马音/挂件", () => {
      render(<Sender sender={FULL_SENDER} variant="avatar-name" />);
      expect(screen.getByText("测试用户")).toBeTruthy();
      // 隐藏罗马音
      expect(screen.queryByText("tesuto")).toBeNull();
      // 隐藏牌子
      expect(screen.queryByText(/堇色信笺/)).toBeNull();
      // 隐藏船型标签
      expect(screen.queryByText("舰长")).toBeNull();
      // 隐藏挂件
      expect(document.querySelector('[src*="guard-badge"]')).toBeNull();
    });

    it("variant='avatar-name' 无牌子的用户也正常渲染", () => {
      const noMedalSender = { ...FULL_SENDER, medal: null, guardLevel: null };
      render(<Sender sender={noMedalSender} variant="avatar-name" />);
      expect(screen.getByText("测试用户")).toBeTruthy();
      expect(screen.queryByText(/堇色信笺/)).toBeNull();
      expect(screen.queryByText("舰长")).toBeNull();
    });
  });
});
