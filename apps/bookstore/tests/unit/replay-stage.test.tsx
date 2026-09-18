// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import ReplayStage from "@/features/recordings/replay/ReplayStage";

const h = vi.hoisted(() => ({
  isSupported: vi.fn(() => Promise.resolve(true)),
  fetchReplayEvents: vi.fn(async () => ({ ok: true, total: 0, items: [] })),
}));

vi.mock("@/features/recordings/api", () => ({
  recordingFileUrl: (roomId: number, name: string) =>
    `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
}));

vi.mock("@/features/recordings/player", () => ({
  isPlaybackSupported: h.isSupported,
  probeSeekable: vi.fn(async () => false),
  play: vi.fn(async () => {}),
  destroyPlayer: vi.fn(),
  pausePlayer: vi.fn(),
  resumePlayer: vi.fn(),
  configureBufferForBitrate: vi.fn(),
  subscribePlayer: vi.fn(() => () => {}),
  getPlayingUrl: vi.fn(() => null),
}));

vi.mock("@/features/recordings/seek", () => ({ seekUnbuffered: vi.fn(async () => true) }));

vi.mock("@/features/recordings/replay/replayEvents", () => ({ fetchReplayEvents: h.fetchReplayEvents }));

const file = {
  name: "回放.flv",
  size: 1024,
  createdAt: "2026-09-17T11:00:00.000Z",
  info: {
    recordingId: "rec-1",
    title: "夜读",
    mid: 1,
    startedAt: "2026-09-17T10:00:00.000Z",
    endedAt: "2026-09-17T11:00:00.000Z",
  },
};
const bounds = {
  startMs: Date.parse(file.info.startedAt),
  endMs: Date.parse(file.info.endedAt),
  fallback: false,
};

const requestFullscreen = vi.fn(() => Promise.resolve());
const exitFullscreen = vi.fn(() => Promise.resolve());

beforeEach(() => {
  h.isSupported.mockReturnValue(Promise.resolve(true));
  h.fetchReplayEvents.mockResolvedValue({ ok: true, total: 0, items: [] });
  requestFullscreen.mockClear();
  exitFullscreen.mockClear();
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen = requestFullscreen;
  (document as unknown as { exitFullscreen?: unknown }).exitFullscreen = exitFullscreen;
  (HTMLCanvasElement.prototype as unknown as { getContext?: unknown }).getContext = () => null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
  delete (document as unknown as { exitFullscreen?: unknown }).exitFullscreen;
  document.body.style.overflow = "";
});

async function renderStage() {
  render(<ReplayStage roomId={1} file={file} bounds={bounds} />);
  await screen.findByLabelText("录播视频");
}

describe("ReplayStage 视频能力零回归", () => {
  it("渲染视频画面、进度条、音量与播放控制，事件列表与浮层同屏", async () => {
    await renderStage();
    expect(screen.getByLabelText("录播视频")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "播放进度" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "音量" })).toBeTruthy();
    expect(screen.getByLabelText("事件列表")).toBeTruthy();
    expect(screen.getByTestId("danmaku-overlay")).toBeTruthy();
    // 下载入口在播放控制栏，事件列表不再渲染「弹幕事件」标题
    expect(screen.getByRole("link", { name: "下载该场录播" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "弹幕事件" })).toBeNull();
  });
});

describe("ReplayStage 双全屏", () => {
  it("网页全屏作用于舞台容器（含事件列表）并锁定滚动", async () => {
    await renderStage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });

    const stage = screen.getByTestId("replay-stage");
    expect(stage.className).toContain("fixed");
    expect(stage.className).toContain("inset-0");
    expect(stage.className).toContain("z-50");
    expect(stage.contains(screen.getByLabelText("事件列表"))).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    // 受控 web 模式下播放区容器不得再 fixed 铺满视口（否则脱离舞台布局并遮挡事件列表）
    const panel = screen.getByLabelText("录播播放区");
    const panelContainer = panel.querySelector("[data-fullscreen-container]") as HTMLElement;
    expect(panelContainer).toBeTruthy();
    expect(panelContainer.className).not.toContain("fixed");
    expect(panelContainer.className).not.toContain("inset-0");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "退出网页全屏" }));
    });
    expect(screen.getByTestId("replay-stage").className).not.toContain("z-50");
    expect(document.body.style.overflow).toBe("");
  });

  it("native 全屏目标仅视频+浮层容器，事件列表不进入", async () => {
    await renderStage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    const panel = screen.getByLabelText("录播播放区");
    const nativeContainer = panel.querySelector("[data-fullscreen-container]") as HTMLElement;
    expect(nativeContainer).toBeTruthy();
    expect(nativeContainer.contains(screen.getByLabelText("事件列表"))).toBe(false);
    expect(nativeContainer.contains(screen.getByTestId("danmaku-overlay"))).toBe(true);
    // native 模式不影响舞台容器布局
    expect(screen.getByTestId("replay-stage").className).not.toContain("z-50");
    expect(document.body.style.overflow).toBe("");
  });

  it("两种模式互斥：native → web 先退出 native", async () => {
    await renderStage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    });
    expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "退出网页全屏" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("ESC 退出网页全屏", async () => {
    await renderStage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    await screen.findByRole("button", { name: "退出网页全屏" });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.getByRole("button", { name: "网页全屏" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("fullscreenEnabled=false：隐藏「全屏」，保留「网页全屏」", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    await renderStage();
    expect(screen.queryByRole("button", { name: "全屏" })).toBeNull();
    expect(screen.getByRole("button", { name: "网页全屏" })).toBeTruthy();
  });
});

describe("ReplayStage 桌面布局", () => {
  it("视频列 lg:w-4/5、事件列 lg:w-1/5 且无固定高度，二者同处 lg:flex-row 弹性行", async () => {
    await renderStage();
    const videoCol = screen.getByLabelText("录播播放区").parentElement as HTMLElement;
    expect(videoCol.className).toContain("lg:w-4/5");
    expect(videoCol.className).not.toContain("lg:w-3/4");

    const timelineCol = screen.getByLabelText("事件列表").parentElement as HTMLElement;
    expect(timelineCol.className).toContain("lg:w-1/5");
    expect(timelineCol.className).not.toContain("lg:h-[70vh]");
    expect(timelineCol.parentElement).toBe(videoCol.parentElement);
    expect(videoCol.parentElement?.className).toContain("lg:flex-row");
  });

  it("长事件列表不撑开事件列：包裹层 lg:relative、内层 lg:absolute lg:inset-0 脱离文档流", async () => {
    await renderStage();
    const timeline = screen.getByLabelText("事件列表");
    const timelineCol = timeline.parentElement as HTMLElement;
    // 内层绝对定位于相对定位包裹层：内容固有高度不参与行高计算
    expect(timeline.className).toContain("lg:absolute");
    expect(timeline.className).toContain("lg:inset-0");
    expect(timelineCol.className).toContain("lg:relative");
    // 滚动容器仍在，负责列内滚动
    expect(screen.getByTestId("event-timeline-scroll")).toBeTruthy();
  });

  it("网页全屏下事件列保持 1/5 列宽且不加固定高度", async () => {
    await renderStage();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    const timelineCol = screen.getByLabelText("事件列表").parentElement as HTMLElement;
    expect(timelineCol.className).toContain("lg:w-1/5");
    expect(timelineCol.className).not.toContain("lg:h-[70vh]");
  });
});

describe("ReplayStage MSE 降级", () => {
  it("不支持在线播放：展示降级提示，事件列表仍正常展示", async () => {
    h.isSupported.mockReturnValue(Promise.resolve(false));
    render(<ReplayStage roomId={1} file={file} bounds={bounds} />);
    expect(await screen.findByText(/当前浏览器不支持在线播放/)).toBeTruthy();
    expect(screen.getByLabelText("事件列表")).toBeTruthy();
    expect(screen.queryByTestId("danmaku-overlay")).toBeNull();
  });
});
