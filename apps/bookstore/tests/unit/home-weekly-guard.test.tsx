// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import FullpageDeck from "@/features/home/FullpageDeck";
import type { Asset, Profile, Site } from "@/lib/content";

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
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="parallax-layer">{children}</div>,
}));

vi.mock("@/features/home/sections/ArchiveSection", () => ({
  default: () => <section data-testid="archive">档案</section>,
}));

vi.mock("@/features/schedule/CalendarViewPage", () => ({
  default: () => <div>日历</div>,
}));

vi.mock("@/features/assets/AssetGallery", () => ({
  default: () => <div>素材</div>,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <footer data-testid="stream-footer">footer</footer>,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock("@/lib/content", () => ({
  getProfile: () => ({
    displayName: "枝堇Sumire", birthdayText: "", zodiac: "", race: "", height: "",
    identity: "", agency: "", generation: "", fanBadge: "", emoji: "", modelArtist: "",
    bio: "是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。", quote: "", color: "#b4a6bf",
    debutStory: "", debutIntro: "", likes: [], dislikes: [], games: [], bookAnimeTypes: [],
    musicTypes: [], gameGenre: "", milestones: [], anecdotes: [], links: [],
  }),
  getSite: () => ({
    name: "枝堇", disclaimer: "本站为非官方粉丝作品",
    links: { live: "https://live.example", bilibili: "https://b", moegirl: "https://m" },
  }),
  getAssetById: () => ({ id: "standing-01", title: "", file: "" }),
  getAssets: () => [],
}));

function matchMediaStub() {
  return { matches: false, media: "", addEventListener() {}, removeEventListener() {} };
}

function deckProps(): { profile: Profile; site: Site; heroAsset: Asset; archivePortraits: Asset[]; assets: Asset[] } {
  const asset = { id: "standing-01", title: "", category: "standing", file: "", width: 1000, height: 2000 } as Asset;
  return {
    profile: {
      name: "枝堇", nameEn: "Sumire", displayName: "枝堇Sumire", birthday: "04-02",
      birthdayText: "", zodiac: "", race: "", height: "",
      identity: "", agency: "", generation: "", fanBadge: "", emoji: "", modelArtist: "",
      bio: "是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。", quote: "", color: "#b4a6bf",
      debutStory: "", debutIntro: "", likes: [], dislikes: [], games: [], bookAnimeTypes: [],
      musicTypes: [], gameGenre: "", milestones: [], anecdotes: [], links: [],
    } as Profile,
    site: {
      name: "枝堇", tagline: "", description: "", disclaimer: "本站为非官方粉丝作品", color: "#b4a6bf",
      links: { live: "https://live.example", bilibili: "https://b", moegirl: "https://m" },
    } as Site,
    heroAsset: asset,
    archivePortraits: [asset],
    assets: [],
  };
}

describe("主页整页滚动结构守卫", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    configured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    window.history.replaceState(null, "", "/");
  });

  it("文案块与 bio 存在；素材站尾部有流式 Footer", () => {
    render(<FullpageDeck {...deckProps()} />);
    expect(screen.getByText(/VirtuaReal · 二十八期/)).toBeTruthy();
    expect(screen.getByText(/是老书屋的一株藤蔓/)).toBeTruthy();
    expect(screen.queryByTestId("weekly-schedule")).toBeNull();
  });

  it("API_CONFIGURED=true 时挂载直播状态与今日日程组件", () => {
    render(<FullpageDeck {...deckProps()} />);
    expect(screen.getByTestId("live-status")).toBeTruthy();
    expect(screen.getByTestId("today-schedule")).toBeTruthy();
  });

  it("API_CONFIGURED=false 时不渲染直播状态 / 今日日程（无占位）", () => {
    configured = false;
    vi.resetModules();
    render(<FullpageDeck {...deckProps()} />);
    expect(screen.queryByTestId("live-status")).toBeNull();
    expect(screen.queryByTestId("today-schedule")).toBeNull();
  });
});