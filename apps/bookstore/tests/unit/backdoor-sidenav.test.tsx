// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SideNav from "@/features/backdoor/components/SideNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/backdoor",
}));

describe("SideNav 按角色渲染", () => {
  afterEach(() => {
    cleanup();
  });

  it("超管可见仪表盘/直播计划/弹幕后台/用户管理", () => {
    render(<SideNav role="superadmin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕后台")).toBeTruthy();
    expect(screen.getByText("用户管理")).toBeTruthy();
    expect(screen.queryByText("增加用户")).toBeNull();
  });

  it("管理员可见仪表盘/直播计划/弹幕后台（无用户管理）", () => {
    render(<SideNav role="admin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕后台")).toBeTruthy();
    expect(screen.queryByText("用户管理")).toBeNull();
    expect(screen.queryByText("增加用户")).toBeNull();
  });

  it("成员可见仪表盘/直播计划/弹幕后台（无用户管理）", () => {
    render(<SideNav role="member" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("直播计划")).toBeTruthy();
    expect(screen.getByText("弹幕后台")).toBeTruthy();
    expect(screen.queryByText("增加用户")).toBeNull();
    expect(screen.queryByText("用户管理")).toBeNull();
  });
});
