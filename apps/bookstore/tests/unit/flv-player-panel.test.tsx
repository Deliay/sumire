// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act, fireEvent, within } from "@testing-library/react";
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

const room = (roomId: number, streamerName: string) => ({
  roomId,
  mid: roomId * 100,
  streamerName,
  state: "not_live",
  sessionTitle: null,
  updatedAt: "2026-09-14T12:00:00.000Z",
});

const file = (name: string, size = 1024, createdAt = "2026-09-01T00:00:00.000Z") => ({ name, size, createdAt });

async function renderAndExpand(files = [file("回放 一.flv"), file("回放二.flv")]) {
  h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇")] });
  h.getRoomRecordings.mockResolvedValue({ ok: true, files });
  render(<RecordingsApp />);
  const header = await screen.findByRole("button", { name: /枝堇/ });
  await act(async () => {
    fireEvent.click(header);
  });
}

beforeEach(() => {
  h.recordingsConfigured = true;
  h.getRecordingStatus.mockReset();
  h.getRoomRecordings.mockReset();
  mp.players.length = 0;
  mp.createPlayer.mockClear();
  mp.isSupported.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FLV 在线预览", () => {
  it("点击文件项创建 player（isLive:false）并展示播放区；切换文件销毁旧实例", async () => {
    await renderAndExpand();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await vi.waitFor(() => expect(mp.createPlayer).toHaveBeenCalledTimes(1));
    expect(mp.createPlayer.mock.calls[0][0]).toMatchObject({
      type: "flv",
      isLive: false,
      url: `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
    });
    expect(screen.getByRole("button", { name: "关闭播放区" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放二.flv" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(2));
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("播放区含播放/暂停、音量与关闭；关闭后销毁 player", async () => {
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });

    expect(await screen.findByRole("button", { name: "暂停" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "音量" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "关闭播放区" }));
    });
    expect(screen.queryByRole("button", { name: "关闭播放区" })).toBeNull();
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("暂停按钮切换播放/暂停", async () => {
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "暂停" }));
    });
    expect(mp.players[0].pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "播放" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "播放" }));
    });
    expect(mp.players[0].play.mock.calls.length).toBeGreaterThan(1);
  });

  it("isSupported=false：展示降级提示与下载，不创建 player", async () => {
    mp.isSupported.mockReturnValue(false);
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    expect(await screen.findByText(/当前浏览器不支持在线播放/)).toBeTruthy();
    expect(mp.createPlayer).not.toHaveBeenCalled();
    const panel = screen.getByLabelText("录播播放区");
    const download = within(panel).getByRole("link", { name: /下载/ });
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
    );
  });

  it("播放错误事件展示提示且列表交互不受影响", async () => {
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(1));
    const errorCall = mp.players[0].on.mock.calls.find(([evt]) => evt === "error");
    expect(errorCall).toBeTruthy();

    await act(async () => {
      (errorCall![1] as () => void)();
    });
    expect(screen.getByText(/播放失败/)).toBeTruthy();
    // 列表仍可切换
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放二.flv" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(2));
  });

  it("文件项「下载」链接与播放同源且文件名经编码", async () => {
    await renderAndExpand([file("中文 名.flv")]);
    const download = screen.getByRole("link", { name: /下载/ });
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("中文 名.flv")}`,
    );
    expect(download.getAttribute("download")).not.toBeNull();
  });

  it("组件卸载销毁 player", async () => {
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(1));
    cleanup();
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });
});
