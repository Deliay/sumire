// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import MarshmallowCard from "@/features/topics/components/MarshmallowCard";
import type { Marshmallow } from "@/features/topics/types";

let roCallback: ResizeObserverCallback | null = null;

beforeEach(() => {
  roCallback = null;
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      roCallback = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  roCallback = null;
  vi.restoreAllMocks();
});

function makeMarshmallow(over: Partial<Marshmallow> = {}): Marshmallow {
  return {
    id: "m1",
    topicId: "t1",
    content: "内容正文",
    adopted: false,
    aiReview: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  } as Marshmallow;
}

/** 模拟内容超过 5 行：令 line-clamp 容器的 scrollHeight > clientHeight 并触发 ResizeObserver 回调。 */
function triggerOverflow() {
  const contentEl = screen
    .getByText("内容正文")
    .closest("div.line-clamp-5") as HTMLElement;
  Object.defineProperty(contentEl, "scrollHeight", { value: 400, configurable: true });
  Object.defineProperty(contentEl, "clientHeight", { value: 120, configurable: true });
  roCallback!([], {
    observe() {},
    unobserve() {},
    disconnect() {},
    takeRecords: () => [],
  } as unknown as ResizeObserver);
}

describe("MarshmallowCard 折叠交互", () => {
  it("内容超过 5 行时显示渐变层，点击打开全文弹窗", async () => {
    render(<MarshmallowCard marshmallow={makeMarshmallow()} onToggleAdopt={vi.fn()} />);
    expect(screen.queryByText("点击查看全文")).not.toBeInTheDocument();

    triggerOverflow();

    const overlay = await screen.findByText("点击查看全文");
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay);
    expect(screen.getByText("棉花糖全文")).toBeInTheDocument();
    expect(screen.getByText("关闭")).toBeInTheDocument();
  });

  it("弹窗内采用切换调用 onToggleAdopt", async () => {
    const onToggle = vi.fn();
    render(<MarshmallowCard marshmallow={makeMarshmallow()} onToggleAdopt={onToggle} />);
    triggerOverflow();
    fireEvent.click(await screen.findByText("点击查看全文"));

    const dialog = document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
    expect(dialog).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "采用" }));
    expect(onToggle).toHaveBeenCalledWith("m1", true);
  });

  it("内容未超 5 行时不渲染渐变层", () => {
    render(<MarshmallowCard marshmallow={makeMarshmallow()} onToggleAdopt={vi.fn()} />);
    expect(screen.queryByText("点击查看全文")).not.toBeInTheDocument();
    expect(screen.queryByText("棉花糖全文")).not.toBeInTheDocument();
  });
});

describe("MarshmallowCard AI 覆盖层不透明", () => {
  it("rejected 覆盖层为不透明实色底（不透出内容）", () => {
    render(
      <MarshmallowCard
        marshmallow={makeMarshmallow({
          aiReview: { status: "rejected", filteredReason: "测试原因", ignoredByAdmin: false },
        })}
        onShowAnyway={vi.fn()}
      />,
    );
    const overlay = screen.getByText(/AI拒绝原因/).closest(".absolute.inset-0") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass(/bg-night/);
    expect(overlay.className).not.toMatch(/\/\d+/); // 非半透明（无 /80 等透明度）
  });

  it("pending 覆盖层为不透明实色底", () => {
    render(
      <MarshmallowCard
        marshmallow={makeMarshmallow({
          aiReview: { status: "pending", ignoredByAdmin: false },
        })}
        onShowAnyway={vi.fn()}
      />,
    );
    const overlay = screen.getByText("这条内容AI正在审核中").closest(".absolute.inset-0") as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass(/bg-night/);
    expect(overlay.className).not.toMatch(/\/\d+/);
  });

  it("aiReview 为 null（未启用）时不渲染覆盖层", () => {
    render(<MarshmallowCard marshmallow={makeMarshmallow()} />);
    expect(screen.queryByText(/AI拒绝原因/)).not.toBeInTheDocument();
    expect(screen.queryByText("这条内容AI正在审核中")).not.toBeInTheDocument();
  });
});