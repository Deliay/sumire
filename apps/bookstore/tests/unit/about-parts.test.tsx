// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProfilePart from "@/features/about/parts/ProfilePart";
import StoryPart from "@/features/about/parts/StoryPart";
import TastePart from "@/features/about/parts/TastePart";
import JourneyPart from "@/features/about/parts/JourneyPart";
import TriviaPart from "@/features/about/parts/TriviaPart";
import { getProfile } from "@/lib/content";
import { getAssetById } from "@/lib/content";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt} />;
  },
}));

describe("about parts 五组内容组件", () => {
  afterEach(() => cleanup());

  const profile = getProfile();

  it("ProfilePart 渲染本名等关键信息", () => {
    render(<ProfilePart profile={profile} portrait={getAssetById("standing-02")!} />);
    expect(screen.getByText("本名")).toBeTruthy();
    expect(screen.getByText(profile.displayName)).toBeTruthy();
    expect(screen.getByText("应援色")).toBeTruthy();
  });

  it("StoryPart 渲染设定标题与引文", () => {
    render(<StoryPart profile={profile} />);
    expect(screen.getByText("设定")).toBeTruthy();
    expect(screen.getByText(/VirtuaReal 预告专栏/)).toBeTruthy();
  });

  it("TastePart 渲染喜好标签", () => {
    render(<TastePart profile={profile} />);
    expect(screen.getByText("喜好")).toBeTruthy();
    expect(screen.getByText("喜欢")).toBeTruthy();
    expect(screen.getByText(profile.likes[0]!)).toBeTruthy();
  });

  it("JourneyPart 渲染历程节点", () => {
    render(<JourneyPart profile={profile} />);
    expect(screen.getByText("历程")).toBeTruthy();
    expect(screen.getByText(profile.milestones[0]!.title)).toBeTruthy();
  });

  it("TriviaPart 渲染逸闻卡与外链按钮", () => {
    render(<TriviaPart profile={profile} />);
    expect(screen.getByText("逸闻")).toBeTruthy();
    expect(screen.getByText(profile.anecdotes[0]!.title)).toBeTruthy();
    expect(screen.getByText("传送门")).toBeTruthy();
    expect(screen.getByText(profile.links[0]!.label)).toBeTruthy();
  });

  it("/about 顺序渲染五组内容（顺序守卫）", () => {
    const { container } = render(
      <>
        <ProfilePart profile={profile} portrait={getAssetById("standing-02")!} />
        <StoryPart profile={profile} />
        <TastePart profile={profile} />
        <JourneyPart profile={profile} />
        <TriviaPart profile={profile} />
      </>,
    );
    const text = container.textContent ?? "";
    const order = [
      "应援色",
      "设定",
      "喜好",
      "历程",
      "逸闻",
      "传送门",
    ];
    let last = -1;
    for (const key of order) {
      const idx = text.indexOf(key);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });
});