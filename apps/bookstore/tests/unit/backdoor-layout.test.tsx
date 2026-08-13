// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BackdoorLayout from "@/app/backdoor/layout";

const mocks = vi.hoisted(() => ({
  apiConfigured: false,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return mocks.apiConfigured;
  },
}));

vi.mock("@/features/backdoor/session", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("backdoor layout 未配置守卫", () => {
  afterEach(() => {
    cleanup();
  });

  it("未配置 API 基址时渲染 404 页且不渲染 children", () => {
    mocks.apiConfigured = false;
    render(
      <BackdoorLayout>
        <div>后台内容</div>
      </BackdoorLayout>,
    );
    expect(screen.getByText("页面不存在")).toBeTruthy();
    expect(screen.queryByText("后台内容")).toBeNull();
  });

  it("已配置 API 基址时正常渲染 children", () => {
    mocks.apiConfigured = true;
    render(
      <BackdoorLayout>
        <div>后台内容</div>
      </BackdoorLayout>,
    );
    expect(screen.getByText("后台内容")).toBeTruthy();
    expect(screen.queryByText("页面不存在")).toBeNull();
  });
});
