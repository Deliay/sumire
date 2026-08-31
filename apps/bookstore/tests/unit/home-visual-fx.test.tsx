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

vi.mock("@/features/home/GlowParticles", () => ({
  default: () => <canvas data-testid="glow-particles" aria-hidden />,
}));

vi.mock("@/features/home/ParallaxLayer", () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="parallax-layer" className={className}>
      {children}
    </div>
  ),
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
    title: "枝堇立绘",
    file: "",
    thumb: "",
    assetType: "standing",
  }),
}));

async function loadHome() {
  return (await import("@/app/(site)/page")).default;
}

describe("首页动效层接线结构守卫", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    configured = true;
  });

  it("渲染粒子 canvas 层与 ParallaxLayer 包裹的立绘", async () => {
    const Home = await loadHome();
    render(<Home />);
    const canvas = document.querySelector('[data-testid="glow-particles"]');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");

    const layer = screen.getByTestId("parallax-layer");
    expect(layer).toBeTruthy();
    // 立绘定位类由 page.tsx 透传，ParallaxLayer 保留原 className
    expect(layer.className).toContain("pointer-events-none");
    expect(layer.className).toContain("absolute");
    // 立绘 <Image> 仍在层内
    expect(layer.querySelector("img")).toBeTruthy();
  });

  it("API_CONFIGURED=true 时挂载直播状态与今日日程（动效层不影响守卫）", async () => {
    const Home = await loadHome();
    render(<Home />);
    expect(screen.getByTestId("live-status")).toBeTruthy();
    expect(screen.getByTestId("today-schedule")).toBeTruthy();
    expect(screen.getByTestId("glow-particles")).toBeTruthy();
  });

  it("API_CONFIGURED=false 时不渲染直播状态 / 今日日程，动效层仍渲染", async () => {
    configured = false;
    vi.resetModules();
    const Home = await loadHome();
    render(<Home />);
    expect(screen.queryByTestId("live-status")).toBeNull();
    expect(screen.queryByTestId("today-schedule")).toBeNull();
    expect(document.querySelector('[data-testid="glow-particles"]')).toBeTruthy();
  });
});