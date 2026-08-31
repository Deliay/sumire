// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import LiveStatus from "@/features/home/LiveStatus";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

const liveStatusMock = vi.fn();
vi.mock("@/features/home/api", () => ({
  getLiveStatus: (...args: unknown[]) => liveStatusMock(...args),
}));

function renderLive() {
  return render(<LiveStatus liveUrl="https://live.bilibili.com/1727076670" />);
}

describe("LiveStatus 直播状态组件", () => {
  beforeEach(() => {
    configured = true;
    liveStatusMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("API_CONFIGURED=false 时不渲染", () => {
    configured = false;
    renderLive();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("直播中态：文案 + 链接指向直播间（新窗口 + noopener）", async () => {
    liveStatusMock.mockResolvedValue({
      ok: true,
      status: { live: true, title: "歌回", startedAt: "2026-08-31T12:00:00.000Z" },
    });
    renderLive();
    const link = await screen.findByRole("link", { name: /直播中/ });
    expect(link).toHaveAttribute("href", "https://live.bilibili.com/1727076670");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel") ?? "").toContain("noopener");
  });

  it("未开播态", async () => {
    liveStatusMock.mockResolvedValue({
      ok: true,
      status: { live: false, title: null, startedAt: null },
    });
    renderLive();
    expect(await screen.findByRole("link", { name: /未开播/ })).toBeTruthy();
  });

  it("降级态（ok:false）渲染中性状态", async () => {
    liveStatusMock.mockResolvedValue({ ok: false, status: null });
    renderLive();
    expect(await screen.findByRole("link", { name: /直播状态/ })).toBeTruthy();
  });

  it("请求失败同样降级为中性状态", async () => {
    liveStatusMock.mockRejectedValue(new Error("network"));
    renderLive();
    expect(await screen.findByRole("link", { name: /直播状态/ })).toBeTruthy();
  });
});