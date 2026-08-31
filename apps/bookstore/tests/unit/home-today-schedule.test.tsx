// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TodaySchedule from "@/features/home/TodaySchedule";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

const listPlansMock = vi.fn();
vi.mock("@/features/schedule/api", () => ({
  listPlans: (...args: unknown[]) => listPlansMock(...args),
}));

function renderToday() {
  return render(<TodaySchedule />);
}

describe("TodaySchedule 今日日程组件", () => {
  beforeEach(() => {
    configured = true;
    listPlansMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("API_CONFIGURED=false 时不渲染", () => {
    configured = false;
    renderToday();
    expect(screen.queryByText("今日日程")).toBeNull();
  });

  it("有计划时渲染时间 + 主题", async () => {
    listPlansMock.mockResolvedValue({
      status: 200,
      data: {
        plans: [
          { id: "1", date: "2026-08-31", startTime: "20:00", title: "歌回", createdAt: "" },
          { id: "2", date: "2026-08-31", startTime: "21:00", title: "杂谈", createdAt: "" },
        ],
      },
    });
    renderToday();
    expect(await screen.findByText("歌回")).toBeTruthy();
    expect(screen.getByText("20:00")).toBeTruthy();
    expect(screen.getByText("杂谈")).toBeTruthy();
  });

  it("无计划时展示空态文案", async () => {
    listPlansMock.mockResolvedValue({ status: 200, data: { plans: [] } });
    renderToday();
    expect(await screen.findByText("今日暂无安排")).toBeTruthy();
  });

  it("请求失败静默为空态", async () => {
    listPlansMock.mockResolvedValue({ status: 500, data: { error: "x" } });
    renderToday();
    expect(await screen.findByText("今日暂无安排")).toBeTruthy();
  });
});