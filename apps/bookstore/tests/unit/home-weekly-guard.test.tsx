// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

vi.mock("@/features/home/LiveStatus", () => ({
  default: () => <div data-testid="live-status">直播状态</div>,
}));

vi.mock("@/features/home/TodaySchedule", () => ({
  default: () => <div data-testid="today-schedule">今日日程</div>,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock("@/lib/content", () => ({
  getProfile: () => ({
    birthdayText: "",
    race: "",
    agency: "",
    generation: "",
    fanBadge: "",
    bio: "是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。",
    color: "#b4a6bf",
  }),
  getSite: () => ({ name: "枝堇", links: { live: "https://live.example" } }),
  getAssetById: () => ({
    id: "standing-01",
    title: "",
    file: "",
    thumb: "",
    assetType: "standing",
  }),
}));

async function loadHome() {
  return (await import("@/app/(site)/page")).default;
}

describe("主页一屏结构守卫", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    configured = true;
  });

  it("文案块与 bio 存在；不再渲染本周日程 / 入口卡 / 速览条", async () => {
    const Home = await loadHome();
    render(<Home />);
    expect(screen.getByText(/VirtuaReal · 二十八期/)).toBeTruthy();
    expect(screen.getByText(/是老书屋的一株藤蔓/)).toBeTruthy();
    expect(screen.queryByTestId("weekly-schedule")).toBeNull();
    expect(screen.queryByText(/主播档案/)).toBeNull();
    expect(screen.queryByText(/周边素材/)).toBeNull();
    expect(screen.queryByText(/了解更多 →/)).toBeNull();
  });

  it("API_CONFIGURED=true 时挂载直播状态与今日日程组件", async () => {
    const Home = await loadHome();
    render(<Home />);
    expect(screen.getByTestId("live-status")).toBeTruthy();
    expect(screen.getByTestId("today-schedule")).toBeTruthy();
  });

  it("API_CONFIGURED=false 时不渲染直播状态 / 今日日程（无占位）", async () => {
    configured = false;
    vi.resetModules();
    const Home = await loadHome();
    render(<Home />);
    expect(screen.queryByTestId("live-status")).toBeNull();
    expect(screen.queryByTestId("today-schedule")).toBeNull();
  });
});