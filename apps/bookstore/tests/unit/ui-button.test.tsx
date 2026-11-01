// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";

describe("Button", () => {
  afterEach(() => cleanup());

  it("四变体类名", () => {
    for (const [variant, cls] of [
      ["primary", "bg-primary"],
      ["secondary", "border-line-strong"],
      ["ghost", "text-ink-dim"],
      ["danger", "text-crimson"],
    ] as const) {
      render(<Button variant={variant}>动作</Button>);
      expect(screen.getByRole("button", { name: "动作" }).className).toContain(cls);
      cleanup();
    }
  });

  it("两档高度 md 44 / sm 36", () => {
    render(<Button>主</Button>);
    expect(screen.getByRole("button").className).toContain("h-11");
    cleanup();
    render(<Button size="sm">次</Button>);
    expect(screen.getByRole("button").className).toContain("h-9");
  });

  it("href 渲染 <a> 并透传 download/target/rel", () => {
    render(
      <Button href="/x" download target="_blank" rel="noopener noreferrer" icon={<Download size={14} />}>
        下载
      </Button>,
    );
    const link = screen.getByRole("link", { name: "下载" });
    expect(link.getAttribute("href")).toBe("/x");
    expect(link.hasAttribute("download")).toBe(true);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("loading 禁用 + aria-busy + 「处理中…」", () => {
    render(<Button loading>保存</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toContain("处理中…");
  });

  it("disabled 不可点击", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        禁止
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("iconPosition 控制图标位置", () => {
    render(
      <Button icon={<Download data-testid="icon" size={14} />} iconPosition="end">
        结束
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.lastElementChild?.querySelector("[data-testid='icon']")).toBeTruthy();
  });
});
