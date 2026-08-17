// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import DatePicker, { formatDateLabel } from "@/features/schedule/DatePicker";
import TimePicker from "@/features/schedule/TimePicker";
import { dayTitle } from "@/features/schedule/DayDetailDialog";
import { parseTimeStr } from "@/features/schedule/dateUtils";

afterEach(() => {
  cleanup();
});

describe("formatDateLabel", () => {
  it("YYYY-MM-DD → 中文年月日", () => {
    expect(formatDateLabel("2026-08-15")).toBe("2026 年 8 月 15 日");
    expect(formatDateLabel("")).toBe("");
  });
});

describe("DatePicker", () => {
  it("点击展开迷你月历并选中日期", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);
    const input = screen.getByLabelText("日期");
    fireEvent.focus(input);
    fireEvent.click(screen.getByLabelText(/选择 2026-08-15/));
    expect(onChange).toHaveBeenCalledWith("2026-08-15");
  });

  it("日期输入框 autocomplete 属性为 off", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("日期");
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("非法键入回退并提示", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} />);
    const input = screen.getByLabelText("日期");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2026-13-01" } });
    fireEvent.blur(input);
    expect(screen.getByText("日期格式应为 YYYY-MM-DD")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TimePicker", () => {
  it("快捷时段一键填入", () => {
    const onChange = vi.fn();
    render(<TimePicker value="" onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText("开始时间"));
    fireEvent.click(screen.getByText("20:00"));
    expect(onChange).toHaveBeenCalledWith("20:00");
  });

  it("开始时间输入框 autocomplete 属性为 off", () => {
    render(<TimePicker value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText("开始时间");
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("容错键入 9:5 → 09:05", () => {
    const onChange = vi.fn();
    render(<TimePicker value="" onChange={onChange} />);
    const input = screen.getByLabelText("开始时间");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9:5" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("09:05");
  });

  it("非法键入回退并提示", () => {
    const onChange = vi.fn();
    render(<TimePicker value="" onChange={onChange} />);
    const input = screen.getByLabelText("开始时间");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "24:00" } });
    fireEvent.blur(input);
    expect(screen.getByText("时间格式应为 HH:mm")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("dayTitle", () => {
  it("生成「8 月 15 日 · 周X」", () => {
    expect(dayTitle("2026-08-15")).toMatch(/^8 月 15 日 · 周[一二三四五六日]$/);
  });
});

describe("parseTimeStr", () => {
  it("补零与非法", () => {
    expect(parseTimeStr("9:5")).toBe("09:05");
    expect(parseTimeStr("24:00")).toBeNull();
  });
});
