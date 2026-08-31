// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

vi.mock("@/features/schedule/CalendarViewPage", () => ({
  default: () => <div data-testid="calendar-page">直播日程</div>,
}));

async function loadPage() {
  return (await import("@/app/(site)/(content)/calendar/page")).default;
}

describe("/calendar 未配置守卫", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    configured = true;
  });

  it("已配置时渲染日历页", async () => {
    const Page = await loadPage();
    const { container } = render(<Page />);
    expect(screen.getByTestId("calendar-page")).toBeTruthy();
    expect(container.textContent).not.toContain("404");
  });

  it("未配置时渲染 404 且不渲染日历页", async () => {
    configured = false;
    vi.resetModules();
    const Page = await loadPage();
    const { container } = render(<Page />);
    expect(screen.getByText("页面不存在")).toBeTruthy();
    expect(screen.queryByTestId("calendar-page")).toBeNull();
    expect(container.textContent).toContain("404");
  });
});
