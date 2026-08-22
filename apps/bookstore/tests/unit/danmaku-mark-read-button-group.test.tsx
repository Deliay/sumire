// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import type { Role } from "@/features/backdoor/api";
import MarkReadButtonGroup from "@/features/danmaku/components/MarkReadButtonGroup";

let currentRole: Role = "admin";
vi.mock("@/features/backdoor/session", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      me: { ok: true, username: "u", role: currentRole, mustChangePassword: false },
    },
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

describe("MarkReadButtonGroup", () => {
  beforeEach(() => {
    currentRole = "admin";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("admin 平铺渲染三项：SC 全部已读、上船 全部已读、隐藏钢镚", () => {
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /上船 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "隐藏钢镚" })).toBeTruthy();
  });

  it("点击 SC 全部已读进入确认态，3s 超时自动复位", () => {
    vi.useFakeTimers();
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /SC 全部已读/ }));
    expect(onReadAll).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /确认全部已读/ })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(onReadAll).not.toHaveBeenCalled();
  });

  it("二次确认后触发 onReadAll(super_chat)", () => {
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /SC 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("super_chat");
  });

  it("上船全部已读二次确认后触发 onReadAll(guard_buy)", () => {
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /上船 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("guard_buy");
  });

  it("隐藏钢镚 switch aria-checked 反映状态", () => {
    const { rerender } = render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.getByRole("switch", { name: "隐藏钢镚" }).getAttribute("aria-checked")).toBe("false");
    rerender(
      <MarkReadButtonGroup hideLowSc={true} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.getByRole("switch", { name: "隐藏钢镚" }).getAttribute("aria-checked")).toBe("true");
  });

  it("点击隐藏钢镚触发 onToggleHideLowSc", () => {
    const onToggle = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={onToggle} onReadAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "隐藏钢镚" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("member（canManage=false）仅渲染隐藏钢镚，不渲染全部已读", () => {
    currentRole = "member";
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /全部已读/ })).toBeNull();
    expect(screen.getByRole("switch", { name: "隐藏钢镚" })).toBeTruthy();
  });
});
