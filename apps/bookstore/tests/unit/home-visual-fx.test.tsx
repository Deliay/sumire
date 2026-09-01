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
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="parallax-layer" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

vi.mock("@/features/about/parts", () => ({
  ProfilePart: () => <div>档案信息</div>,
  StoryPart: () => <div>设定故事</div>,
  TastePart: () => <div>喜好</div>,
  JourneyPart: () => <div>历程</div>,
  TriviaPart: () => <div>轶闻</div>,
}));

vi.mock("@/features/schedule/CalendarViewPage", () => ({
  default: () => <div data-testid="calendar">日历</div>,
}));

vi.mock("@/features/assets/AssetGallery", () => ({
  default: () => <div data-testid="asset-gallery">素材</div>,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <footer data-testid="stream-footer">footer</footer>,
}));

vi.mock("@/lib/content", () => ({
  getProfile: () => ({
    displayName: "枝堇Sumire",
    birthdayText: "4月2日",
    zodiac: "白羊座",
    race: "藤",
    height: "165cm",
    identity: "店主",
    agency: "VirtuaReal",
    generation: "二十八期",
    fanBadge: "小粉螈",
    emoji: "😁",
    modelArtist: "天雨Rainfall",
    bio: "是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。",
    quote: "弹幕有点不乖啊",
    color: "#b4a6bf",
    debutStory: "设定",
    debutIntro: "引文",
    likes: [],
    dislikes: [],
    games: [],
    bookAnimeTypes: [],
    musicTypes: [],
    gameGenre: "",
    milestones: [{ date: "2026-08-05", title: "开始活动" }],
    anecdotes: [{ title: "轶闻一", body: "正文", emoji: "😁" }],
    links: [{ url: "https://x", label: "B站" }],
  }),
  getSite: () => ({
    name: "枝堇",
    disclaimer: "本站为非官方粉丝作品",
    links: { live: "https://live.example", bilibili: "https://b", moegirl: "https://m" },
  }),
  getAssetById: () => ({
    id: "standing-01",
    title: "枝堇立绘",
    file: "",
    thumb: "",
    assetType: "standing",
  }),
  getAssets: () => [],
}));

function matchMediaStub() {
  const mql = { matches: false, media: "", addEventListener() {}, removeEventListener() {} };
  return mql;
}

function deckProps(): { profile: Profile; site: Site; heroAsset: Asset; archivePortraits: Asset[]; assets: Asset[] } {
  const asset = { id: "standing-01", title: "枝堇立绘", category: "standing", file: "", width: 1000, height: 2000 } as Asset;
  return {
    profile: {
      name: "枝堇",
      nameEn: "Sumire",
      displayName: "枝堇Sumire",
      birthday: "04-02",
      birthdayText: "4月2日",
      zodiac: "白羊座",
      race: "藤",
      height: "165cm",
      identity: "店主",
      agency: "VirtuaReal",
      generation: "二十八期",
      fanBadge: "小粉螈",
      emoji: "😁",
      modelArtist: "天雨Rainfall",
      bio: "是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。",
      quote: "弹幕有点不乖啊",
      color: "#b4a6bf",
      debutStory: "设定",
      debutIntro: "引文",
      likes: [],
      dislikes: [],
      games: [],
      bookAnimeTypes: [],
      musicTypes: [],
      gameGenre: "",
      milestones: [{ date: "2026-08-05", title: "开始活动" }],
      anecdotes: [{ title: "轶闻一", body: "正文", emoji: "😁" }],
      links: [{ url: "https://x", label: "B站" }],
    } as Profile,
    site: {
      name: "枝堇",
      tagline: "小书屋",
      description: "书屋",
      disclaimer: "本站为非官方粉丝作品",
      color: "#b4a6bf",
      links: { live: "https://live.example", bilibili: "https://b", moegirl: "https://m" },
    } as Site,
    heroAsset: asset,
    archivePortraits: [asset],
    assets: [],
  };
}

describe("首页动效层接线结构守卫", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    configured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    window.history.replaceState(null, "", "/");
  });

  it("渲染粒子 canvas 层与 ParallaxLayer 包裹的立绘（首页站）", () => {
    render(<FullpageDeck {...deckProps()} />);
    const canvas = document.querySelector('[data-testid="glow-particles"]');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");

    const layer = screen.getByTestId("parallax-layer");
    expect(layer).toBeTruthy();
    expect(layer.className).toContain("pointer-events-none");
    expect(layer.querySelector("img")).toBeTruthy();
  });

  it("API_CONFIGURED=true 时挂载直播状态与今日日程（动效层不影响守卫）", () => {
    render(<FullpageDeck {...deckProps()} />);
    expect(screen.getByTestId("live-status")).toBeTruthy();
    expect(screen.getByTestId("today-schedule")).toBeTruthy();
    expect(screen.getByTestId("glow-particles")).toBeTruthy();
  });

  it("API_CONFIGURED=false 时不渲染直播状态 / 今日日程，动效层仍渲染", () => {
    configured = false;
    vi.resetModules();
    render(<FullpageDeck {...deckProps()} />);
    expect(screen.queryByTestId("live-status")).toBeNull();
    expect(screen.queryByTestId("today-schedule")).toBeNull();
    expect(document.querySelector('[data-testid="glow-particles"]')).toBeTruthy();
  });
});