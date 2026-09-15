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
  seekToByteOffset: ReturnType<typeof vi.fn>;
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
      seekToByteOffset: vi.fn(),
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

const sk = vi.hoisted(() => ({ seekUnbuffered: vi.fn() }));
vi.mock("@/features/recordings/seek", () => ({ seekUnbuffered: sk.seekUnbuffered }));

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
  sk.seekUnbuffered.mockReset();
  sk.seekUnbuffered.mockResolvedValue(true);
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

  it("上游支持 Range 且已缓冲落点：直接定位 currentTime，不触发 seekUnbuffered", async () => {
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
    Object.defineProperty(video, "buffered", {
      configurable: true,
      value: { length: 1, start: () => 0, end: () => 120 },
    });
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
    expect(sk.seekUnbuffered).not.toHaveBeenCalled();
  });

  it("未缓冲落点：调用 seekUnbuffered 且不写 currentTime，seek 中展示缓冲反馈", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    let resolveSeek!: (value: boolean) => void;
    sk.seekUnbuffered.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSeek = resolve;
        }),
    );
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });

    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    Object.defineProperty(video, "buffered", { configurable: true, value: { length: 0, start: () => 0, end: () => 0 } });
    await act(async () => {
      fireEvent.loadedMetadata(video);
    });

    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    await vi.waitFor(() => expect(progress.disabled).toBe(false));

    await act(async () => {
      fireEvent.change(progress, { target: { value: "60" } });
    });

    expect(sk.seekUnbuffered).toHaveBeenCalledWith({
      url: `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
      targetSeconds: 60,
      durationSeconds: 120,
      fileSize: 1024,
    });
    expect(video.currentTime).toBe(0);
    expect(screen.getByRole("status")).toBeTruthy();

    await act(async () => {
      resolveSeek(true);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("快速连续 seek：组件以最后落点调用编排（last-wins 由 seek 模块负责）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    sk.seekUnbuffered.mockResolvedValue(true);
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });

    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    Object.defineProperty(video, "buffered", { configurable: true, value: { length: 0, start: () => 0, end: () => 0 } });
    await act(async () => {
      fireEvent.loadedMetadata(video);
    });
    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    await vi.waitFor(() => expect(progress.disabled).toBe(false));

    await act(async () => {
      fireEvent.change(progress, { target: { value: "30" } });
      fireEvent.change(progress, { target: { value: "80" } });
    });
    const calls = sk.seekUnbuffered.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[calls.length - 1][0]).toMatchObject({ targetSeconds: 80 });
  });

  it("seek 失败（seekUnbuffered 返回 false）：展示播放失败提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    sk.seekUnbuffered.mockResolvedValue(false);
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });

    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    Object.defineProperty(video, "duration", { configurable: true, value: 120 });
    Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: 0 });
    Object.defineProperty(video, "buffered", { configurable: true, value: { length: 0, start: () => 0, end: () => 0 } });
    await act(async () => {
      fireEvent.loadedMetadata(video);
    });
    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    await vi.waitFor(() => expect(progress.disabled).toBe(false));

    await act(async () => {
      fireEvent.change(progress, { target: { value: "60" } });
    });
    expect(await screen.findByText(/播放失败/)).toBeTruthy();
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

describe("全屏与网页全屏", () => {
  const requestFullscreen = vi.fn(() => Promise.resolve());
  const exitFullscreen = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    requestFullscreen.mockClear();
    exitFullscreen.mockClear();
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
    (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen = requestFullscreen;
    (document as unknown as { exitFullscreen?: unknown }).exitFullscreen = exitFullscreen;
  });

  afterEach(() => {
    delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    delete (document as unknown as { exitFullscreen?: unknown }).exitFullscreen;
    document.body.style.overflow = "";
  });

  async function openPanel() {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    await renderAndExpand();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "回放 一.flv" }));
    });
    await screen.findByRole("button", { name: "暂停" });
  }

  function fullscreenContainer(): HTMLElement {
    const container = screen.getByLabelText("录播播放区").querySelector("[data-fullscreen-container]");
    expect(container).toBeTruthy();
    return container as HTMLElement;
  }

  it("控制条渲染「全屏」「网页全屏」按钮", async () => {
    await openPanel();
    expect(screen.getByRole("button", { name: "全屏" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "网页全屏" })).toBeTruthy();
  });

  it("点击「全屏」请求容器全屏并切换为「退出全屏」；ESC（fullscreenchange）复位", async () => {
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();

    Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
    await act(async () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(screen.getByRole("button", { name: "全屏" })).toBeTruthy();
  });

  it("点击「网页全屏」铺满视口并锁定滚动，退出还原", async () => {
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    const container = fullscreenContainer();
    expect(container.className).toContain("fixed");
    expect(container.className).toContain("inset-0");
    expect(container.className).toContain("z-50");
    expect(document.body.style.overflow).toBe("hidden");
    const exit = await screen.findByRole("button", { name: "退出网页全屏" });

    await act(async () => {
      fireEvent.click(exit);
    });
    expect(container.className).not.toContain("z-50");
    expect(document.body.style.overflow).toBe("");
  });

  it("ESC 键退出网页全屏", async () => {
    await openPanel();
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

  it("native 与 web 全屏互斥，不叠加", async () => {
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    });
    await screen.findByRole("button", { name: "退出全屏" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "退出网页全屏" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
    });
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("关闭播放区前复位全屏并还原滚动", async () => {
    await openPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    await screen.findByRole("button", { name: "退出网页全屏" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "关闭播放区" }));
    });
    expect(screen.queryByLabelText("录播播放区")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("document.fullscreenEnabled=false：隐藏「全屏」，保留「网页全屏」", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    await openPanel();
    expect(screen.queryByRole("button", { name: "全屏" })).toBeNull();
    expect(screen.getByRole("button", { name: "网页全屏" })).toBeTruthy();
  });
});
