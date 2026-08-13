// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import type { StreamPlan } from "@/features/schedule/api";

const makePlan = (id: string, startTime: string, title: string): StreamPlan => ({
  id,
  date: "2026-08-15",
  startTime,
  title,
  createdAt: "",
});

afterEach(() => {
  cleanup();
});

describe("DayDetailDialog 只读模式", () => {
  it("展示空态文案", () => {
    render(<DayDetailDialog open date="2026-08-15" plans={[]} readOnly onClose={() => {}} />);
    expect(screen.getByText("这一天书屋静悄悄的。")).toBeTruthy();
  });

  it("按开始时间升序展示计划，且不渲染管理操作", () => {
    render(
      <DayDetailDialog
        open
        date="2026-08-15"
        readOnly
        onClose={() => {}}
        plans={[makePlan("2", "20:00", "晚"), makePlan("1", "08:00", "早")]}
      />,
    );
    const list = screen.getByRole("dialog");
    const order = Array.from(list.querySelectorAll("li")).map((li) => li.textContent);
    expect(order[0]).toContain("08:00");
    expect(order[1]).toContain("20:00");
    expect(screen.queryByText("增加计划")).toBeNull();
    expect(screen.queryByText("编辑")).toBeNull();
    expect(screen.queryByText("删除")).toBeNull();
  });
});

describe("DayDetailDialog 管理模式", () => {
  it("展示编辑/删除与增加计划入口", () => {
    const onAdd = vi.fn();
    render(
      <DayDetailDialog
        open
        date="2026-08-15"
        readOnly={false}
        onClose={() => {}}
        onAdd={onAdd}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        plans={[makePlan("1", "08:00", "早台读书")]}
      />,
    );
    expect(screen.getByText("编辑")).toBeTruthy();
    expect(screen.getByText("删除")).toBeTruthy();
    fireEvent.click(screen.getByText(/增加计划/));
    expect(onAdd).toHaveBeenCalled();
  });

  it("删除先展开二次确认，确认后触发 onDelete", () => {
    const onDelete = vi.fn();
    render(
      <DayDetailDialog
        open
        date="2026-08-15"
        readOnly={false}
        onClose={() => {}}
        onEdit={vi.fn()}
        onDelete={onDelete}
        plans={[makePlan("1", "08:00", "早台读书")]}
      />,
    );
    fireEvent.click(screen.getByLabelText("删除 早台读书"));
    expect(screen.getByText(/确认删除 08:00 早台读书/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("确认删除"));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
