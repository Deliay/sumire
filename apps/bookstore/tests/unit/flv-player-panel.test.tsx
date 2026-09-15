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

const room = (roomId: number, streamerName: string, state = "not_live") => ({
  roomId,
  mid: roomId * 100,
  streamerName,
  state,
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
  // 默认上游不支持 Range（探测请求返回 200）
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ status: 200, headers: { get: () => null }, body: { cancel: async () => {} } }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  it("播放区含可见视频画面、播放/暂停、可拖动进度条与音量；关闭后销毁 player", async () => {
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });

    expect(await screen.findByRole("button", { name: "暂停" })).toBeTruthy();
    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    expect(video.hidden).toBe(false);
    expect(video.getAttribute("aria-hidden")).toBeNull();
    // 进度条存在；上游不支持 Range（探测 200）时禁用并明示
    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    expect(progress.disabled).toBe(true);
    expect(await screen.findByText(/不支持拖动进度/)).toBeTruthy();
    expect(screen.getByRole("slider", { name: "音量" })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "关闭播放区" }));
    });
    expect(screen.queryByRole("button", { name: "关闭播放区" })).toBeNull();
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("上游支持 Range 且获知时长后可拖动进度条 seek 到指定位置", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });

    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    await act(async () => {
      fireEvent.loadedMetadata(video);
    });

    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    await vi.waitFor(() => expect(progress.disabled).toBe(false));
    expect(screen.queryByText(/不支持拖动进度/)).toBeNull();
    expect(screen.getByText("00:00 / 02:00")).toBeTruthy();

    await act(async () => {
      fireEvent.change(progress, { target: { value: "60" } });
    });
    expect(video.currentTime).toBe(60);
    expect(screen.getByText("01:00 / 02:00")).toBeTruthy();
  });

  it("再次点击播放中的文件项折叠并销毁 player；同一时间仅一个播放区", async () => {
    await renderAndExpand();
    const first = screen.getByRole("button", { name: "回放 一.flv" });
    await act(async () => {
      fireEvent.click(first);
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(1));
    expect(screen.getAllByLabelText("录播播放区")).toHaveLength(1);

    // 点击另一文件项：前一个折叠销毁、仅一个新播放区
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放二.flv" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(2));
    expect(mp.players[0].destroy).toHaveBeenCalledTimes(1);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByLabelText("录播播放区")).toHaveLength(1);

    // 再次点击当前文件项：折叠销毁
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放二.flv" }));
    });
    expect(screen.queryAllByLabelText("录播播放区")).toHaveLength(0);
    expect(mp.players[1].destroy).toHaveBeenCalledTimes(1);
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

  it("被「听直播」接管后播放区复位，可重新播放录播", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇", "recording")] });
    h.getRoomRecordings.mockResolvedValue({ ok: true, files: [file("回放.flv")] });
    render(<RecordingsApp />);

    const header = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(header);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放.flv" }));
    });
    expect(await screen.findByRole("button", { name: "暂停" })).toBeTruthy();
    expect(mp.players).toHaveLength(1);

    // 「听直播」接管：录播预览失去播放归属，按钮复位为「播放」
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "听直播" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(2));
    expect(await screen.findByRole("button", { name: "播放" })).toBeTruthy();

    // 点击「播放」重新加载录播
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "播放" }));
    });
    await vi.waitFor(() => expect(mp.players).toHaveLength(3));
    expect(await screen.findByRole("button", { name: "暂停" })).toBeTruthy();
  });
});
