// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CalendarView from "@/features/schedule/CalendarView";
import type { StreamPlan } from "@/features/schedule/api";

function todayStr(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function pastStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const makePlan = (date: string, title: string, id = title): StreamPlan => ({
  id,
  date,
  title,
  createdAt: "",
});

describe("CalendarView", () => {
  afterEach(() => {
    cleanup();
  });

  it("渲染当前月标题", () => {
    const now = new Date();
    render(<CalendarView plans={[]} />);
    expect(screen.getByText(`${now.getFullYear()} 年 ${now.getMonth() + 1} 月`)).toBeTruthy();
  });

  it("有计划日期展示主题；同日多场全部展示", () => {
    const d = todayStr();
    render(
      <CalendarView
        plans={[makePlan(d, "杂谈"), makePlan(d, "歌回", "g")]}
      />,
    );
    expect(screen.getByText("杂谈")).toBeTruthy();
    expect(screen.getByText("歌回")).toBeTruthy();
  });

  it("今日描边（cell 含 today 日期且非 past 弱化）", () => {
    const today = todayStr();
    render(<CalendarView plans={[]} />);
    const dayCells = screen.getAllByTestId("calendar-day");
    const todayCell = dayCells.find((el) => el.getAttribute("data-date") === today);
    expect(todayCell).toBeTruthy();
    expect(todayCell?.className).toContain("border-flower");
  });

  it("过去日期计划带已播出样式（line-through）", () => {
    const past = pastStr(-2);
    render(<CalendarView plans={[makePlan(past, "已播")]} />);
    const dayCells = screen.getAllByTestId("calendar-day");
    const cell = dayCells.find((el) => el.getAttribute("data-date") === past);
    expect(cell).toBeTruthy();
    const title = cell!.querySelector('[data-testid="plan-title"]');
    expect(title?.textContent).toBe("已播");
    expect(title?.className).toContain("line-through");
  });

  it("翻月回调返回新区间", () => {
    const onMonthChange = vi.fn();
    render(<CalendarView plans={[]} onMonthChange={onMonthChange} />);
    fireEvent.click(screen.getByLabelText("下一月"));
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    const [from, to] = onMonthChange.mock.calls[0] as [string, string];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
