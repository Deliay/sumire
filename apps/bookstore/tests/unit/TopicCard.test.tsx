// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TopicCard from "@/features/topics/components/TopicCard";

afterEach(() => cleanup());

describe("TopicCard", () => {
  it("已归档卡片仅显示「恢复」，不显示归档/修改/停止收集", () => {
    const onRestore = vi.fn();
    render(
      <TopicCard
        id="t1"
        title="归档主题"
        status="ended"
        archived
        onRestore={onRestore}
        onStartStop={vi.fn()}
        onArchive={vi.fn()}
        onEdit={vi.fn()}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修改" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /收集/ })).not.toBeInTheDocument();
  });

  it("已归档卡片点击「恢复」回调 onRestore", () => {
    const onRestore = vi.fn();
    render(
      <TopicCard id="t1" title="t" status="ended" archived onRestore={onRestore} onClick={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    expect(onRestore).toHaveBeenCalled();
  });

  it("非归档卡片显示停止收集/归档/修改", () => {
    render(
      <TopicCard
        id="t1"
        title="t"
        status="collecting"
        onStartStop={vi.fn()}
        onArchive={vi.fn()}
        onEdit={vi.fn()}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "停止收集" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "归档" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修改" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "恢复" })).not.toBeInTheDocument();
  });
});