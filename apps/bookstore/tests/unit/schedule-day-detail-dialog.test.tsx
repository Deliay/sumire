// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import DayDetailDialog from "@/features/schedule/DayDetailDialog";
import type { StreamPlan } from "@/features/schedule/api";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";

const makePlan = (id: string, startTime: string, title: string): StreamPlan => ({
  id,
  date: "2026-08-15",
  startTime,
  title,
  createdAt: "",
});

const planEntry = (p: StreamPlan): CalendarEntry => ({
  kind: "plan",
  plan: p,
  date: p.date,
  startTime: p.startTime,
});

const historyEntry = (title: string, startTime: string, endTime?: string): CalendarEntry => ({
  kind: "history",
  record: { title, startDate: `2026-08-15T${startTime}:00` },
  date: "2026-08-15",
  startTime,
  endTime,
});

afterEach(() => {
  cleanup();
});

describe("DayDetailDialog 只读模式", () => {
  it("打开时锁定背景滚动（供全站弹层屏蔽整页翻页），关闭时恢复", () => {
    const { rerender } = render(<DayDetailDialog open date="2026-08-15" entries={[]} readOnly onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<DayDetailDialog open={false} date="2026-08-15" entries={[]} readOnly onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("只读面板为悬浮面板形态：不整屏变灰/无 backdrop-blur（公开站当日详情）", () => {
    render(<DayDetailDialog open date="2026-08-15" entries={[]} readOnly onClose={() => {}} />);
    const overlay = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(overlay).toBeTruthy();
    // 回归：公开站当日详情不得用全屏灰罩/毛玻璃（与后台管理态遮罩口径区分）
    expect(overlay.className).not.toContain("bg-black");
    expect(overlay.className).not.toContain("backdrop");
  });

  it("展示空态文案", () => {
    render(<DayDetailDialog open date="2026-08-15" entries={[]} readOnly onClose={() => {}} />);
    expect(screen.getByText("这一天书屋静悄悄的。")).toBeTruthy();
  });

  it("按开始时间升序展示计划，且不渲染管理操作", () => {
    render(
      <DayDetailDialog
        open
        date="2026-08-15"
        readOnly
        onClose={() => {}}
        entries={[planEntry(makePlan("2", "20:00", "晚")), planEntry(makePlan("1", "08:00", "早"))]}
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

  it("历史记录行带「实际播出」标签、无编辑/删除、附结束时刻", () => {
    render(
      <DayDetailDialog
        open
        date="2026-08-15"
        readOnly
        onClose={() => {}}
        entries={[historyEntry("实录场", "13:00", "15:00"), planEntry(makePlan("1", "20:00", "晚"))]}
      />,
    );
    expect(screen.getByText("实录场")).toBeTruthy();
    expect(screen.getByText("实际播出")).toBeTruthy();
    expect(screen.getByText(/至 15:00/)).toBeTruthy();
    expect(screen.queryByText("编辑")).toBeNull();
    expect(screen.queryByText("删除")).toBeNull();
  });
});

describe("DayDetailDialog 管理模式", () => {
  it("展示编辑/删除与增加计划入口（仅计划条目）", () => {
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
        entries={[planEntry(makePlan("1", "08:00", "早台读书")), historyEntry("实录", "09:00")]}
      />,
    );
    expect(screen.getByText("编辑")).toBeTruthy();
    expect(screen.getByText("删除")).toBeTruthy();
    // 历史记录只读，不出现编辑/删除（此处仅计划行各一个编辑/删除按钮）
    expect(screen.getAllByText("编辑")).toHaveLength(1);
    expect(screen.getAllByText("删除")).toHaveLength(1);
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
        entries={[planEntry(makePlan("1", "08:00", "早台读书"))]}
      />,
    );
    fireEvent.click(screen.getByLabelText("删除 早台读书"));
    expect(screen.getByText(/确认删除 08:00 早台读书/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("确认删除"));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
