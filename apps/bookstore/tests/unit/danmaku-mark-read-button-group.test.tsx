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

/** 按查询字符串返回对应 matches 的 matchMedia 桩。 */
function stubMatchMedia(matchesMap: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matchesMap[query] ?? false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/**
 * 在容器 div 上设置 offsetWidth 模拟值，然后触发 resize 事件让
 * useContainerWidth 重新测量。需要在 render 后、effect 读取之前生效，
 * 因此先 mock 原型 → render → 设置容器值 → 读取 → 恢复原型。
 */
function mockParentWidth(parentWidth: number) {
  // 让 useContainerWidth 的 useEffect 读到 parentWidth（原型级别兜底）
  const spy = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get");
  spy.mockReturnValue(parentWidth);
  return spy;
}

describe("MarkReadButtonGroup", () => {
  beforeEach(() => {
    currentRole = "admin";
    stubMatchMedia({ "(max-width: 639px)": false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("admin 平铺渲染三项：SC 全部已读、上船 全部已读、隐藏钢镚", () => {
    // 宽视口 + 容器足够宽 → 平铺
    mockParentWidth(600);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /上船 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "隐藏钢镚" })).toBeTruthy();
  });

  it("点击 SC 全部已读进入确认态，3s 超时自动复位", () => {
    vi.useFakeTimers();
    mockParentWidth(600);
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
    mockParentWidth(600);
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /SC 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("super_chat");
  });

  it("上船全部已读二次确认后触发 onReadAll(guard_buy)", () => {
    mockParentWidth(600);
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /上船 全部已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认全部已读/ }));
    expect(onReadAll).toHaveBeenCalledWith("guard_buy");
  });

  it("隐藏钢镚 switch aria-checked 反映状态", () => {
    mockParentWidth(600);
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
    mockParentWidth(600);
    const onToggle = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={onToggle} onReadAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "隐藏钢镚" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("member（canManage=false）仅渲染隐藏钢镚，不渲染全部已读", () => {
    currentRole = "member";
    mockParentWidth(600);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /全部已读/ })).toBeNull();
    expect(screen.getByRole("switch", { name: "隐藏钢镚" })).toBeTruthy();
  });

  it("narrow(<640) 折叠为 dropdown：渲染「标记已读」触发钮，点击展开菜单", () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    // 平铺按钮不可见
    expect(screen.queryByRole("button", { name: /SC 全部已读/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /上船 全部已读/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "隐藏钢镚" })).toBeNull();
    // 折叠触发钮
    const trigger = screen.getByRole("button", { name: "标记已读" });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    // 点击展开
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    // dropdown 内容
    expect(screen.getByText("SC 全部已读")).toBeTruthy();
    expect(screen.getByText("上船 全部已读")).toBeTruthy();
    expect(screen.getByText("隐藏钢镚")).toBeTruthy();
  });

  it("dropdown 内点击 SC 全部已读进入确认态，确认后收起菜单", () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    const onReadAll = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={onReadAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "标记已读" }));
    // 点击 SC 全部已读
    fireEvent.click(screen.getByText("SC 全部已读"));
    expect(screen.getByText("确认全部已读？")).toBeTruthy();
    // 确认
    fireEvent.click(screen.getByText("确认全部已读？"));
    expect(onReadAll).toHaveBeenCalledWith("super_chat");
    // 菜单收起
    expect(screen.queryByText("SC 全部已读")).toBeNull();
  });

  it("dropdown 内点击隐藏钢镚切换并收起菜单", () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    const onToggle = vi.fn();
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={onToggle} onReadAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "标记已读" }));
    fireEvent.click(screen.getByText("隐藏钢镚"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("隐藏钢镚")).toBeNull();
  });

  it("member 在 narrow 下折叠 dropdown 仅渲染隐藏钢镚，不渲染全部已读", () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    currentRole = "member";
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "标记已读" }));
    expect(screen.getByText("隐藏钢镚")).toBeTruthy();
    expect(screen.queryByText("SC 全部已读")).toBeNull();
    expect(screen.queryByText("上船 全部已读")).toBeNull();
  });

  it("wide 视口父容器宽度不足时折叠为 dropdown", () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    // admin 有 3 项 × 120px = 360px 所需宽度；父容器 200px（不足）
    mockParentWidth(200);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    // 宽视口但父容器窄 → 折叠
    expect(screen.queryByRole("button", { name: /SC 全部已读/ })).toBeNull();
    expect(screen.getByRole("button", { name: "标记已读" })).toBeTruthy();
  });

  it("wide 视口父容器宽度足够时平铺渲染", () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    // admin 有 3 项 × 120px = 360px 所需宽度；父容器 600px（足够）
    mockParentWidth(600);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    // 宽视口且父容器宽 → 平铺
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /上船 全部已读/ })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "隐藏钢镚" })).toBeTruthy();
  });

  it("member 宽视口父容器窄时仅折叠隐藏钢镚，不显示全部已读", () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    currentRole = "member";
    // member 有 1 项 × 120px = 120px；父容器 80px（不足）
    mockParentWidth(80);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "标记已读" }));
    expect(screen.getByText("隐藏钢镚")).toBeTruthy();
    expect(screen.queryByText("SC 全部已读")).toBeNull();
  });

  it("平铺时内容宽度 < 所需宽度不会错误折叠（父容器足够宽）", () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    // 父容器 600px（远大于 360px 所需），即使组件自身内容宽度小也不折叠
    mockParentWidth(600);
    render(
      <MarkReadButtonGroup hideLowSc={false} onToggleHideLowSc={vi.fn()} onReadAll={vi.fn()} />,
    );
    // 应平铺，不折叠
    expect(screen.getByRole("button", { name: /SC 全部已读/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "标记已读" })).toBeNull();
  });
});
