// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Role } from "@/features/backdoor/api";
import SideNav from "@/features/backdoor/components/SideNav";

const usePathname = vi.hoisted(() => vi.fn(() => "/backdoor"));
vi.mock("next/navigation", () => ({
  usePathname,
}));

describe("SideNav 按角色渲染", () => {
  afterEach(() => {
    cleanup();
  });

  it("超管可见仪表盘/直播计划/弹幕看板/用户管理", () => {
    render(<SideNav role="superadmin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕看板")).toBeTruthy();
    expect(screen.getByText("用户管理")).toBeTruthy();
    expect(screen.queryByText("增加用户")).toBeNull();
  });

  it("管理员可见仪表盘/直播计划/弹幕看板（无用户管理）", () => {
    render(<SideNav role="admin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕看板")).toBeTruthy();
    expect(screen.queryByText("用户管理")).toBeNull();
    expect(screen.queryByText("增加用户")).toBeNull();
  });

  it("成员可见仪表盘/直播计划/弹幕看板/弹幕检索（无用户管理）", () => {
    render(<SideNav role="member" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕看板")).toBeTruthy();
    expect(screen.getByText("弹幕检索")).toBeTruthy();
    expect(screen.queryByText("增加用户")).toBeNull();
    expect(screen.queryByText("用户管理")).toBeNull();
  });

  it("弹幕检索菜单在弹幕看板之后", () => {
    render(<SideNav role="superadmin" />);
    const allItems = screen.getAllByRole("link");
    const labels = allItems.map((el) => el.textContent);
    const danmakuIdx = labels.indexOf("弹幕看板");
    const searchIdx = labels.indexOf("弹幕检索");
    expect(danmakuIdx).toBeGreaterThanOrEqual(0);
    expect(searchIdx).toBeGreaterThan(danmakuIdx);
  });
});

describe("SideNav 选中态", () => {
  afterEach(() => cleanup());

  function renderWithRole(pathname: string, role: Role = "superadmin") {
    vi.mocked(usePathname).mockReturnValue(pathname);
    render(<SideNav role={role} />);
  }

  it("/backdoor/danmaku/search 仅「弹幕检索」选中", () => {
    renderWithRole("/backdoor/danmaku/search");
    expect(screen.getByText("弹幕检索").closest("a")).toHaveClass("border-primary");
    expect(screen.getByText("弹幕看板").closest("a")).toHaveClass("border-transparent");
  });

  it("/backdoor/danmaku 仅「弹幕看板」选中", () => {
    renderWithRole("/backdoor/danmaku");
    expect(screen.getByText("弹幕看板").closest("a")).toHaveClass("border-primary");
    expect(screen.getByText("弹幕检索").closest("a")).toHaveClass("border-transparent");
  });

  it("/backdoor 仅「仪表盘」选中", () => {
    renderWithRole("/backdoor");
    expect(screen.getByText("仪表盘").closest("a")).toHaveClass("border-primary");
  });

  it("/backdoor/schedule 仅「直播计划」选中", () => {
    renderWithRole("/backdoor/schedule");
    expect(screen.getByText("直播计划").closest("a")).toHaveClass("border-primary");
  });

  it("/backdoor/users 仅「用户管理」选中", () => {
    renderWithRole("/backdoor/users");
    expect(screen.getByText("用户管理").closest("a")).toHaveClass("border-primary");
  });

  it("/backdoor/users/123 仅「用户管理」选中", () => {
    renderWithRole("/backdoor/users/123");
    expect(screen.getByText("用户管理").closest("a")).toHaveClass("border-primary");
  });

  it("/backdoor/danmaku/search/extra 仅「弹幕检索」选中", () => {
    renderWithRole("/backdoor/danmaku/search/extra");
    expect(screen.getByText("弹幕检索").closest("a")).toHaveClass("border-primary");
    expect(screen.getByText("弹幕看板").closest("a")).toHaveClass("border-transparent");
  });
});
