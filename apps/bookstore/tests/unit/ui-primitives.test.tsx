// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Tag from "@/components/ui/Tag";
import Surface from "@/components/ui/Surface";
import Notice from "@/components/ui/Notice";
import Rule from "@/components/ui/Rule";
import EmptyState from "@/components/ui/EmptyState";

describe("Tag", () => {
  afterEach(() => cleanup());

  it("span 静态标签无 hover 填充", () => {
    render(<Tag>喜欢</Tag>);
    const tag = screen.getByText("喜欢");
    expect(tag.tagName).toBe("SPAN");
    expect(tag.className).toContain("rounded-sm");
    expect(tag.className).not.toContain("hover:bg-soft");
  });

  it("button 可交互标签带 hover", () => {
    render(
      <Tag as="button" onClick={() => {}}>
        筛选
      </Tag>,
    );
    const tag = screen.getByRole("button", { name: "筛选" });
    expect(tag.className).toContain("hover:bg-soft");
  });
});

describe("Surface", () => {
  afterEach(() => cleanup());

  it("三变体 × 三档 padding、无阴影类", () => {
    for (const [variant, cls] of [
      ["raised", "bg-raised"],
      ["outline", "bg-transparent"],
      ["paper", "bg-paper"],
    ] as const) {
      render(
        <Surface variant={variant} padding="lg">
          面板
        </Surface>,
      );
      const el = screen.getByText("面板");
      expect(el.className).toContain(cls);
      expect(el.className).toContain("p-8");
      expect(el.className).toContain("rounded-xs");
      expect(el.className).not.toContain("shadow");
      cleanup();
    }
  });
});

describe("Notice", () => {
  afterEach(() => cleanup());

  it("info 左线 primary", () => {
    render(<Notice title="提示">正文</Notice>);
    expect(screen.getByText("提示").parentElement?.className).toContain("border-l-primary");
  });

  it("warning 左线 gold", () => {
    render(<Notice tone="warning">风险</Notice>);
    expect(screen.getByText("风险").parentElement?.className).toContain("border-l-gold");
  });
});

describe("Rule", () => {
  afterEach(() => cleanup());

  it("无 label 为 1px line", () => {
    const { container } = render(<Rule />);
    expect(container.firstElementChild?.className).toContain("bg-line");
  });

  it("带 label 渲染 mono 标签", () => {
    render(<Rule label="传送门" />);
    expect(screen.getByText("传送门").className).toContain("font-mono");
  });
});

describe("EmptyState", () => {
  afterEach(() => cleanup());

  it("标题 + 说明 + 动作", () => {
    render(<EmptyState title="暂无素材" description="稍后再来" action={<button>刷新</button>} />);
    expect(screen.getByText("暂无素材")).toBeTruthy();
    expect(screen.getByText("稍后再来")).toBeTruthy();
    expect(screen.getByRole("button", { name: "刷新" })).toBeTruthy();
  });
});
