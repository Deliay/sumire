// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import GiftFilterControl from "@/features/danmaku/components/GiftFilterControl";

describe("GiftFilterControl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("渲染礼物筛选按钮", () => {
    render(<GiftFilterControl value={0} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "礼物筛选" })).toBeTruthy();
  });

  it("点击按钮打开/关闭弹层", () => {
    render(<GiftFilterControl value={0} onChange={() => {}} />);
    const button = screen.getByRole("button", { name: "礼物筛选" });
    expect(screen.queryByLabelText("最低礼物价值（元）")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByLabelText("最低礼物价值（元）")).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByLabelText("最低礼物价值（元）")).toBeNull();
  });

  it("value > 0 时按钮激活态", () => {
    render(<GiftFilterControl value={5} onChange={() => {}} />);
    const button = screen.getByRole("button", { name: "礼物筛选" });
    expect(button.className).toContain("border-flower");
  });

  it("滑动条与输入框双向同步", () => {
    render(<GiftFilterControl value={0} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const range = screen.getByRole("slider") as HTMLInputElement;
    const numberInput = screen.getByLabelText("最低礼物价值（元）") as HTMLInputElement;
    expect(range.value).toBe("0");
    expect(numberInput.value).toBe("0");
    fireEvent.change(range, { target: { value: "5" } });
    expect(numberInput.value).toBe("5");
  });

  it("防抖 300ms 提交", () => {
    const onChange = vi.fn();
    render(<GiftFilterControl value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const range = screen.getByRole("slider");
    fireEvent.change(range, { target: { value: "5" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("输入框 blur 立即提交", () => {
    const onChange = vi.fn();
    render(<GiftFilterControl value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const numberInput = screen.getByLabelText("最低礼物价值（元）");
    fireEvent.change(numberInput, { target: { value: "10" } });
    fireEvent.blur(numberInput);
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it("Enter 立即提交", () => {
    const onChange = vi.fn();
    render(<GiftFilterControl value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const numberInput = screen.getByLabelText("最低礼物价值（元）");
    fireEvent.change(numberInput, { target: { value: "8" } });
    fireEvent.keyDown(numberInput, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it("非法输入提交时夹取到 0", () => {
    const onChange = vi.fn();
    render(<GiftFilterControl value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const numberInput = screen.getByLabelText("最低礼物价值（元）");
    fireEvent.change(numberInput, { target: { value: "abc" } });
    fireEvent.blur(numberInput);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("超过 100 夹取到 100", () => {
    const onChange = vi.fn();
    render(<GiftFilterControl value={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "礼物筛选" }));
    const numberInput = screen.getByLabelText("最低礼物价值（元）");
    fireEvent.change(numberInput, { target: { value: "150" } });
    fireEvent.blur(numberInput);
    expect(onChange).toHaveBeenCalledWith(100);
  });
});
