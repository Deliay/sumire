// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RoleBadge from "@/features/backdoor/components/RoleBadge";

describe("RoleBadge 中文角色名", () => {
  afterEach(() => {
    cleanup();
  });

  it("superadmin 显示「超管」", () => {
    render(<RoleBadge role="superadmin" />);
    expect(screen.getByText("超管")).toBeTruthy();
    expect(screen.queryByText("superadmin")).toBeNull();
  });

  it("admin 显示「管理员」", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("管理员")).toBeTruthy();
    expect(screen.queryByText("admin")).toBeNull();
  });

  it("member 显示「成员」", () => {
    render(<RoleBadge role="member" />);
    expect(screen.getByText("成员")).toBeTruthy();
    expect(screen.queryByText("member")).toBeNull();
  });
});
