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

  it("超管可见仪表盘/增加用户/用户管理", () => {
    render(<SideNav role="superadmin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("增加用户")).toBeTruthy();
    expect(screen.getByText("用户管理")).toBeTruthy();
  });

  it("管理员可见仪表盘/增加用户，不见用户管理", () => {
    render(<SideNav role="admin" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.getByText("增加用户")).toBeTruthy();
    expect(screen.queryByText("用户管理")).toBeNull();
  });

  it("成员仅见仪表盘", () => {
    render(<SideNav role="member" />);
    expect(screen.getByText("仪表盘")).toBeTruthy();
    expect(screen.queryByText("增加用户")).toBeNull();
    expect(screen.queryByText("用户管理")).toBeNull();
  });
});
