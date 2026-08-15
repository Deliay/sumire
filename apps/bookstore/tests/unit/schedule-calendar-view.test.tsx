// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import CalendarView from "@/features/schedule/CalendarView";
import type { StreamPlan } from "@/features/schedule/api";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";

function todayStr(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function offsetStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const makePlan = (date: string, title: string, startTime = "20:00", id = title): StreamPlan => ({
  id,
  date,
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

const historyEntry = (date: string, title: string, startTime = "20:00", startDate = `${date}T${startTime}:00`): CalendarEntry => ({
  kind: "history",
  record: { title, startDate },
  date,
  startTime,
});

/** 可变 matchMedia 桩：可动态 set matches 触发 change 事件。 */
function mockMatchMedia(matches: boolean) {
  let listener: ((e: { matches: boolean }) => void) | null = null;
  const mql = {
    matches,
    media: "",
    addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  return {
    stub: () => mql,
    set: (next: boolean) => {
      mql.matches = next;
      listener?.({ matches: next });
    },
  };
}

function weekday(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

describe("CalendarView（月视图，默认无 matchMedia）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("渲染当前月标题", () => {
    const now = new Date();
    render(<CalendarView entries={[]} />);
    expect(screen.getByText(`${now.getFullYear()} 年 ${now.getMonth() + 1} 月`)).toBeTruthy();
  });

  it("有计划日期展示 HH:mm 主题摘要", () => {
    const d = todayStr();
    render(
      <CalendarView
        entries={[planEntry(makePlan(d, "杂谈", "20:00")), planEntry(makePlan(d, "歌回", "13:00", "g"))]}
      />,
    );
    const titles = screen.getAllByTestId("plan-title");
    expect(titles.some((t) => t.textContent?.includes("20:00") && t.textContent?.includes("杂谈"))).toBe(true);
    expect(titles.some((t) => t.textContent?.includes("13:00") && t.textContent?.includes("歌回"))).toBe(true);
  });

  it("同一日超过 2 条计划时以 +N 收尾", () => {
    const d = todayStr();
    render(
      <CalendarView
        entries={[
          planEntry(makePlan(d, "早", "08:00", "1")),
          planEntry(makePlan(d, "午", "13:00", "2")),
          planEntry(makePlan(d, "晚", "20:00", "3")),
        ]}
      />,
    );
    const dayCells = screen.getAllByTestId("calendar-day");
    const cell = dayCells.find((el) => el.getAttribute("data-date") === d)!;
    expect(cell.textContent).toContain("+1");
  });

  it("历史条目以 history-title 区分来源并弱化（已播出样式）", () => {
    const d = todayStr();
    render(
      <CalendarView entries={[planEntry(makePlan(d, "计划", "20:00")), historyEntry(d, "实录场", "13:00")]} />,
    );
    const histories = screen.getAllByTestId("history-title");
    expect(histories.some((t) => t.textContent?.includes("实录场"))).toBe(true);
    expect(histories.every((t) => t.className.includes("text-ink-dim/80"))).toBe(true);
    const plans = screen.getAllByTestId("plan-title");
    expect(plans.some((t) => t.textContent?.includes("计划"))).toBe(true);
  });

  it("今日描边（cell 含 today 日期）", () => {
    const today = todayStr();
    render(<CalendarView entries={[]} />);
    const dayCells = screen.getAllByTestId("calendar-day");
    const todayCell = dayCells.find((el) => el.getAttribute("data-date") === today);
    expect(todayCell).toBeTruthy();
    expect(todayCell?.className).toContain("border-flower");
  });

  it("过去日期计划带已播出样式（opacity 弱化）", () => {
    const past = offsetStr(-2);
    render(<CalendarView entries={[planEntry(makePlan(past, "已播", "20:00"))]} />);
    const dayCells = screen.getAllByTestId("calendar-day");
    const cell = dayCells.find((el) => el.getAttribute("data-date") === past);
    expect(cell).toBeTruthy();
    expect(cell?.className).toContain("opacity-60");
  });

  it("翻月回调返回新区间", () => {
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByLabelText("下一月"));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
    const [from, to] = onRangeChange.mock.calls[0] as [string, string];
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(from <= to).toBe(true);
  });

  it("点击某天触发 onSelectDay", () => {
    const onSelectDay = vi.fn();
    const d = todayStr();
    render(<CalendarView entries={[]} onSelectDay={onSelectDay} />);
    const dayCells = screen.getAllByTestId("calendar-day");
    const cell = dayCells.find((el) => el.getAttribute("data-date") === d)!;
    fireEvent.click(cell);
    expect(onSelectDay).toHaveBeenCalledWith(d);
  });
});

describe("CalendarView（周视图，matchMedia 为真）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("渲染恰好 7 天且默认含今天", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    render(<CalendarView entries={[]} />);
    const cells = screen.getAllByTestId("calendar-day");
    expect(cells).toHaveLength(7);
    const today = todayStr();
    expect(cells.some((c) => c.getAttribute("data-date") === today)).toBe(true);
  });

  it("周切换上抛周一~周日区间", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByLabelText("下一周"));
    expect(onRangeChange).toHaveBeenCalledTimes(1);
    const [from, to] = onRangeChange.mock.calls[0] as [string, string];
    expect(weekday(from)).toBe(1); // 周一
    expect(weekday(to)).toBe(0); // 周日
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    const f = new Date(fy, fm - 1, fd);
    const t = new Date(ty, tm - 1, td);
    expect(Math.round((t.getTime() - f.getTime()) / 86400000)).toBe(6);
  });

  it("「今天」回到本周并上抛本周区间", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByLabelText("下一周"));
    fireEvent.click(screen.getByRole("button", { name: "今天" }));
    expect(onRangeChange).toHaveBeenCalledTimes(2);
    const [from, to] = onRangeChange.mock.calls[1] as [string, string];
    const today = todayStr();
    expect(from <= today && today <= to).toBe(true);
  });

  it("周视图点击某天触发 onSelectDay", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    const onSelectDay = vi.fn();
    const d = todayStr();
    render(<CalendarView entries={[]} onSelectDay={onSelectDay} />);
    const cell = screen.getAllByTestId("calendar-day").find((el) => el.getAttribute("data-date") === d)!;
    fireEvent.click(cell);
    expect(onSelectDay).toHaveBeenCalledWith(d);
  });

  it("断点跨越后选中日期不丢（周→月定位到同月）", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    render(<CalendarView entries={[]} />);
    fireEvent.click(screen.getByLabelText("下一周"));
    const d = new Date();
    d.setDate(d.getDate() + 7);
    act(() => mq.set(false));
    expect(screen.getByText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月`)).toBeTruthy();
  });
});
