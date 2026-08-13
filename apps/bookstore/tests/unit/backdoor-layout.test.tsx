// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BackdoorLayout from "@/app/backdoor/layout";

const mocks = vi.hoisted(() => ({
  apiConfigured: false,
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => mocks.notFound(),
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
  beforeEach(() => {
    mocks.notFound.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("未配置 API 基址时调用 notFound() 且不渲染 children", () => {
    mocks.apiConfigured = false;
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    });
    expect(() =>
      render(
        <BackdoorLayout>
          <div>后台内容</div>
        </BackdoorLayout>,
      ),
    ).toThrow();
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("已配置 API 基址时正常渲染 children", () => {
    mocks.apiConfigured = true;
    render(
      <BackdoorLayout>
        <div>后台内容</div>
      </BackdoorLayout>,
    );
    expect(screen.getByText("后台内容")).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
