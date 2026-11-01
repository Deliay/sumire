// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import SectionHeader from "@/components/layout/SectionHeader";

describe("PageShell", () => {
  afterEach(() => cleanup());

  it("wide 88rem / prose 44rem + 统一 gutter + 桌面装订线", () => {
    const { container } = render(<PageShell width="wide">内容</PageShell>);
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("max-w-[88rem]");
    expect(shell.className).toContain("px-5");
    expect(shell.className).toContain("sm:px-8");
    expect(shell.className).toContain("lg:px-16");
    expect(shell.className).toContain("lg:border-l");
    expect(shell.className).toContain("lg:border-line");
    cleanup();
    const { container: c2 } = render(<PageShell>内容</PageShell>);
    expect((c2.firstElementChild as HTMLElement).className).toContain("max-w-[44rem]");
  });

  it("withNavOffset 控制顶部留白", () => {
    const { container } = render(<PageShell withNavOffset={false}>内容</PageShell>);
    expect((container.firstElementChild as HTMLElement).className).toContain("pt-12");
  });
});

describe("PageHeader / SectionHeader", () => {
  afterEach(() => cleanup());

  it("PageHeader 渲染 eyebrow/folio/h1/lead/actions 与 1px 线", () => {
    const { container } = render(
      <PageHeader eyebrow="Profile" folio="壹" title="枝堇图鉴" lead="引文" actions={<button>动作</button>} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "枝堇图鉴" })).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("壹")).toBeTruthy();
    expect(screen.getByText("引文")).toBeTruthy();
    expect(screen.getByRole("button", { name: "动作" })).toBeTruthy();
    expect(container.querySelector("header")!.className).toContain("border-b");
  });

  it("SectionHeader 默认 h2，as=h1 时唯一 h1", () => {
    render(<SectionHeader title="信息" />);
    expect(screen.getByRole("heading", { level: 2, name: "信息" })).toBeTruthy();
    cleanup();
    render(<SectionHeader as="h1" title="信息" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
