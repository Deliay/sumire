// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import CalendarView from "@/features/schedule/CalendarView";
import { monthGrid, monthGridRange } from "@/features/schedule/dateUtils";
import type { StreamPlan } from "@/features/schedule/api";
import type { CalendarEntry } from "@/features/schedule/mergeEntries";

function todayStr(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

const makePlan = (date: string, title: string, startTime = "20:00", id = title): StreamPlan => ({
  id,
  date,
  timeType: "fixed",
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
    const now = new Date();
    const today = todayStr();
    // 取「今天之前」且在当月展示网格内的最近日期（月初时可能落到上月末补位格），规避跨月/时区硬编码
    const past = monthGrid(now.getFullYear(), now.getMonth() + 1)
      .map((c) => c.dateStr)
      .filter((d) => d < today)
      .sort()
      .at(-1)!;
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

  it("月视图格子网格容器含 grid-rows-6 且占满高度", () => {
    render(<CalendarView entries={[]} />);
    const grids = document.querySelectorAll(".grid.grid-cols-7");
    const cellGrid = grids[1]; // 第二个 grid 是格子容器
    expect(cellGrid).toBeTruthy();
    expect(cellGrid.className).toContain("grid-rows-6");
    expect(cellGrid.className).toContain("h-full");
  });

  it("月视图 DayCell 含 h-full 和 overflow-hidden", () => {
    render(<CalendarView entries={[]} />);
    const cells = screen.getAllByTestId("calendar-day");
    cells.forEach((cell) => {
      expect(cell.className).toContain("h-full");
      expect(cell.className).toContain("overflow-hidden");
    });
  });

  it("goMonth 上抛下月展示网格范围（首末格，非月区间）", () => {
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByLabelText("下一月"));
    const [from, to] = onRangeChange.mock.calls[0] as [string, string];
    const now = new Date();
    const next = now.getMonth() === 11 ? { y: now.getFullYear() + 1, m: 1 } : { y: now.getFullYear(), m: now.getMonth() + 2 };
    expect({ from, to }).toEqual(monthGridRange(next.y, next.m));
  });

  it("补位格有条目时渲染摘要、无条目不渲染「—」；点击补位格不上抛 onSelectDay", () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const fillCell = monthGrid(y, m).find((c) => !c.inMonth);
    expect(fillCell).toBeTruthy();
    const onSelectDay = vi.fn();

    const { rerender } = render(
      <CalendarView entries={[planEntry(makePlan(fillCell!.dateStr, "补位日程", "20:00"))]} onSelectDay={onSelectDay} />,
    );
    const dayCells = screen.getAllByTestId("calendar-day");
    const cell = dayCells.find((el) => el.getAttribute("data-date") === fillCell!.dateStr)!;
    expect(cell.textContent).toContain("补位日程");
    expect(cell.className).toContain("opacity-35");

    fireEvent.click(cell);
    expect(onSelectDay).not.toHaveBeenCalled();

    rerender(<CalendarView entries={[]} onSelectDay={onSelectDay} />);
    const emptyCell = screen
      .getAllByTestId("calendar-day")
      .find((el) => el.getAttribute("data-date") === fillCell!.dateStr)!;
    expect(emptyCell.textContent).not.toContain("—");
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

  it("周视图每天一行纵向展示，含周X 标签", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    render(<CalendarView entries={[]} />);
    for (const label of ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
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

describe("CalendarView immersive 变体（月视图）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("panel（缺省）渲染现 DOM：头部翻月按钮、圆角类存在", () => {
    render(<CalendarView entries={[]} />);
    expect(screen.getByLabelText("下一月")).toBeTruthy();
    expect(screen.getByLabelText("上一月")).toBeTruthy();
    const cells = screen.getAllByTestId("calendar-day");
    cells.forEach((cell) => expect(cell.className).toContain("rounded-md"));
  });

  it("immersive 渲染左右侧全高翻月竖条，点击上抛新区间", () => {
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} variant="immersive" />);
    const nextBar = screen.getByLabelText("下月");
    const prevBar = screen.getByLabelText("上月");
    expect(nextBar.className).toContain("inset-y-0");
    expect(prevBar.className).toContain("inset-y-0");
    fireEvent.click(nextBar);
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it("immersive 月视图 DayCell 直角化（无 rounded-md）", () => {
    render(<CalendarView entries={[]} variant="immersive" />);
    const cells = screen.getAllByTestId("calendar-day");
    cells.forEach((cell) => expect(cell.className).not.toContain("rounded-md"));
  });

  it("immersive 模拟横向拖拽超阈值触发翻月（与按钮同口径）", () => {
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} variant="immersive" />);
    const grid = document.querySelector("[data-testid='immersive-grid']");
    expect(grid).toBeTruthy();
    fireEvent.pointerDown(grid!, { clientX: 200 });
    fireEvent.pointerMove(grid!, { clientX: 120 });
    fireEvent.pointerUp(grid!);
    expect(onRangeChange).toHaveBeenCalledTimes(1);
  });

  it("immersive 拖拽阈值内不触发翻月", () => {
    const onRangeChange = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} variant="immersive" />);
    const grid = document.querySelector("[data-testid='immersive-grid']");
    fireEvent.pointerDown(grid!, { clientX: 200 });
    fireEvent.pointerMove(grid!, { clientX: 190 });
    fireEvent.pointerUp(grid!);
    expect(onRangeChange).not.toHaveBeenCalled();
  });

  it("immersive 拖拽超阈值翻月后抑制日期点击（不弹当日详情）", () => {
    const onRangeChange = vi.fn();
    const onSelectDay = vi.fn();
    render(<CalendarView entries={[]} onRangeChange={onRangeChange} onSelectDay={onSelectDay} variant="immersive" />);
    const grid = document.querySelector("[data-testid='immersive-grid']");
    // 拖拽超阈值（左拖翻下月）
    fireEvent.pointerDown(grid!, { clientX: 200 });
    fireEvent.pointerMove(grid!, { clientX: 100 });
    fireEvent.pointerUp(grid!);
    expect(onRangeChange).toHaveBeenCalledTimes(1);
    // 模拟 click 落在日期格上（同一手势），应被抑制不触发 onSelectDay
    const cell = screen.getAllByTestId("calendar-day")[0]!;
    fireEvent.click(cell);
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("周视图分支不渲染拖拽/竖条按钮", () => {
    const mq = mockMatchMedia(true);
    vi.stubGlobal("matchMedia", mq.stub);
    render(<CalendarView entries={[]} variant="immersive" />);
    expect(screen.queryByTestId("immersive-grid")).toBeNull();
    expect(screen.queryByLabelText("下月")).toBeNull();
    expect(screen.queryByLabelText("上月")).toBeNull();
  });
});
