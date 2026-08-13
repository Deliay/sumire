// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

vi.mock("@/features/home/WeeklySchedule", () => ({
  default: () => <div data-testid="weekly-schedule">本周日程</div>,
}));

vi.mock("@/lib/content", () => ({
  getProfile: () => ({
    birthdayText: "",
    race: "",
    agency: "",
    generation: "",
    fanBadge: "",
    bio: "",
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

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

async function loadHome() {
  return (await import("@/app/(site)/page")).default;
}

describe("主页本周日程入口守卫", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    configured = true;
  });

  it("API_CONFIGURED=true 时挂载本周日程入口", async () => {
    const Home = await loadHome();
    render(<Home />);
    expect(screen.getByTestId("weekly-schedule")).toBeTruthy();
  });

  it("API_CONFIGURED=false 时不出现本周日程入口（无占位）", async () => {
    configured = false;
    vi.resetModules();
    const Home = await loadHome();
    render(<Home />);
    expect(screen.queryByTestId("weekly-schedule")).toBeNull();
  });
});
