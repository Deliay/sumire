// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import RecordingsApp from "@/features/recordings/RecordingsApp";

const h = vi.hoisted(() => ({
  recordingsConfigured: true,
  getRecordingStatus: vi.fn(),
  getRoomRecordings: vi.fn(),
  liveAudioUrl: vi.fn((roomId: number) => `https://rec.example.com/api/b/live/${roomId}/live-stream/audio`),
  recordingFileUrl: vi.fn(
    (roomId: number, name: string) => `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
  ),
}));

vi.mock("@/features/recordings/api", () => ({
  get RECORDINGS_CONFIGURED() {
    return h.recordingsConfigured;
  },
  getRecordingStatus: h.getRecordingStatus,
  getRoomRecordings: h.getRoomRecordings,
  liveAudioUrl: h.liveAudioUrl,
  recordingFileUrl: h.recordingFileUrl,
}));

interface MockPlayer {
  destroy: ReturnType<typeof vi.fn>;
  attachMediaElement: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

const mp = vi.hoisted(() => {
  const players: MockPlayer[] = [];
  const createPlayer = vi.fn<(source: unknown) => MockPlayer>(() => {
    const player: MockPlayer = {
      destroy: vi.fn(),
      attachMediaElement: vi.fn(),
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };
    players.push(player);
    return player;
  });
  return { players, createPlayer, isSupported: vi.fn(() => true) };
});

vi.mock("mpegts.js", () => ({
  default: {
    createPlayer: mp.createPlayer,
    isSupported: mp.isSupported,
    Events: { ERROR: "error" },
  },
}));

const statusItem = (overrides: Record<string, unknown> = {}) => ({
  roomId: 1,
  mid: 100,
  streamerName: "枝堇",
  state: "recording",
  sessionTitle: "夜读会",
  updatedAt: "2026-09-14T12:00:00.000Z",
  ...overrides,
});

function mockStatus(items: unknown[]) {
  h.getRecordingStatus.mockResolvedValue({ ok: true, items });
}

beforeEach(() => {
  h.recordingsConfigured = true;
  h.getRecordingStatus.mockReset();
  h.getRoomRecordings.mockReset();
  h.getRoomRecordings.mockResolvedValue({ ok: true, files: [] });
  mp.players.length = 0;
  mp.createPlayer.mockClear();
  mp.isSupported.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});

describe("RecordingsApp 门控与状态列表", () => {
  it("未配置录播服务：渲染空态且不调用 api", async () => {
    h.recordingsConfigured = false;
    render(<RecordingsApp />);
    expect(screen.getByText(/服务未配置/)).toBeTruthy();
    expect(h.getRecordingStatus).not.toHaveBeenCalled();
  });

  it("渲染状态列表：主播名、状态、场次标题与更新时间", async () => {
    mockStatus([
      statusItem(),
      statusItem({ roomId: 2, mid: 200, streamerName: "另一间", state: "not_live", sessionTitle: null }),
    ]);
    const { container } = render(<RecordingsApp />);

    expect((await screen.findAllByText("枝堇")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("另一间").length).toBeGreaterThan(0);
    expect(screen.getByText("录制中")).toBeTruthy();
    expect(screen.getByText("未在直播")).toBeTruthy();
    expect(screen.getByText("夜读会")).toBeTruthy();
    // 录制中呼吸点
    expect(container.querySelector(".bg-eye")).not.toBeNull();
    // 更新时间
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe("2026-09-14T12:00:00.000Z");
  });

  it("上游失败：展示降级空态，不报错", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: false, items: [] });
    render(<RecordingsApp />);
    expect(await screen.findByText(/录播服务暂时不可用/)).toBeTruthy();
  });
});

describe("录制状态轮询", () => {
  it("首拉 + 30s 轮询 + visibilitychange 暂停/恢复", async () => {
    vi.useFakeTimers();
    mockStatus([statusItem()]);
    render(<RecordingsApp />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(h.getRecordingStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(h.getRecordingStatus).toHaveBeenCalledTimes(2);

    // 页面隐藏：停止轮询
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(h.getRecordingStatus).toHaveBeenCalledTimes(2);

    // 恢复可见：立即刷新一次并重启轮询
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(h.getRecordingStatus).toHaveBeenCalledTimes(3);
  });
});

describe("听直播", () => {
  it("仅录制中房间渲染「听直播」，点击创建单例 player，播放中变「停止」", async () => {
    mockStatus([
      statusItem({ roomId: 1 }),
      statusItem({ roomId: 2, mid: 200, streamerName: "另一间", state: "not_live" }),
    ]);
    render(<RecordingsApp />);
    await screen.findAllByText("枝堇");

    const buttons = screen.getAllByRole("button", { name: /听直播/ });
    expect(buttons).toHaveLength(1);

    await act(async () => {
      fireEvent.click(buttons[0]);
    });

    expect(mp.createPlayer).toHaveBeenCalledTimes(1);
    expect(mp.createPlayer.mock.calls[0][0]).toMatchObject({
      type: "flv",
      isLive: true,
      url: "https://rec.example.com/api/b/live/1/live-stream/audio",
    });
    expect(mp.players[0].attachMediaElement).toHaveBeenCalledTimes(1);
    expect(mp.players[0].load).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /停止/ })).toBeTruthy();
  });

  it("切换到另一房间：旧 player destroy、新 player 创建（全局单例）", async () => {
    mockStatus([statusItem({ roomId: 1 }), statusItem({ roomId: 2, mid: 200, streamerName: "另一间" })]);
    render(<RecordingsApp />);
    await screen.findAllByText("枝堇");

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /听直播/ })[0]);
    });
    expect(mp.players).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /听直播/ })[0]);
    });
    expect(mp.players).toHaveLength(2);
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("组件卸载销毁 player", async () => {
    mockStatus([statusItem({ roomId: 1 })]);
    const { unmount } = render(<RecordingsApp />);
    await screen.findAllByText("枝堇");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /听直播/ }));
    });
    expect(mp.players).toHaveLength(1);

    unmount();
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });
});
