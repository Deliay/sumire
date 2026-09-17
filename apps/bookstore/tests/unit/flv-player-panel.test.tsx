// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { useRef } from "react";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import FlvPlayerPanel from "@/features/recordings/replay/FlvPlayerPanel";

const h = vi.hoisted(() => ({
  recordingFileUrl: vi.fn(
    (roomId: number, name: string) =>
      `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
  ),
}));

vi.mock("@/features/recordings/api", () => ({ recordingFileUrl: h.recordingFileUrl }));

interface MockPlayer {
  destroy: ReturnType<typeof vi.fn>;
  attachMediaElement: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  seekToByteOffset: ReturnType<typeof vi.fn>;
  setBufferLimits: ReturnType<typeof vi.fn>;
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
      setBufferLimits: vi.fn(),
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

const file = (name: string, size = 1024, createdAt = "2026-09-01T00:00:00.000Z") => ({ name, size, createdAt });

beforeEach(() => {
  mp.players.length = 0;
  mp.createPlayer.mockClear();
  mp.isSupported.mockReturnValue(true);
  sk.seekUnbuffered.mockReset();
  sk.seekUnbuffered.mockResolvedValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ status: 200, headers: { get: () => null }, body: { cancel: async () => {} } }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

async function renderPanel(props: Partial<Parameters<typeof FlvPlayerPanel>[0]> = {}) {
  const result = render(<FlvPlayerPanel roomId={1} file={file("回放 一.flv")} {...props} />);
  await screen.findByLabelText("录播视频");
  return result;
}

function setVideo(video: HTMLVideoElement, { duration = 120, currentTime = 0, buffered = false } = {}) {
  Object.defineProperty(video, "duration", { configurable: true, value: duration });
  Object.defineProperty(video, "currentTime", { configurable: true, writable: true, value: currentTime });
  Object.defineProperty(video, "buffered", {
    configurable: true,
    value: buffered
      ? { length: 1, start: () => 0, end: () => duration }
      : { length: 0, start: () => 0, end: () => 0 },
  });
}

describe("FlvPlayerPanel 播放能力", () => {
  it("挂载即创建 player（isLive:false）并展示视频、进度条、音量", async () => {
    await renderPanel();
    await vi.waitFor(() => expect(mp.createPlayer).toHaveBeenCalledTimes(1));
    expect(mp.createPlayer.mock.calls[0][0]).toMatchObject({
      type: "flv",
      isLive: false,
      url: `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
    });
    expect(screen.getByLabelText("录播视频")).toBeTruthy();
    expect(screen.getByRole("slider", { name: "播放进度" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "音量" })).toBeTruthy();
  });

  it("onTimeUpdate 在 metadata/timeupdate 时回调当前时间与时长", async () => {
    const onTimeUpdate = vi.fn();
    await renderPanel({ onTimeUpdate });
    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    setVideo(video, { duration: 120, currentTime: 30 });
    await act(async () => {
      fireEvent.timeUpdate(video);
    });
    expect(onTimeUpdate).toHaveBeenCalledWith(30, 120);
  });

  it("暂停按钮切换播放/暂停", async () => {
    await renderPanel();
    await vi.waitFor(() => expect(mp.players).toHaveLength(1));
    const pause = await screen.findByRole("button", { name: "暂停" });
    await act(async () => {
      fireEvent.click(pause);
    });
    expect(mp.players[0].pause).toHaveBeenCalledTimes(1);
    const play = screen.getByRole("button", { name: "播放" });
    await act(async () => {
      fireEvent.click(play);
    });
    expect(mp.players[0].play.mock.calls.length).toBeGreaterThan(1);
  });

  it("overlay 渲染在视频画面容器内", async () => {
    await renderPanel({ overlay: <div data-testid="overlay" /> });
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("isSupported=false：降级提示 + 下载，不创建 player", async () => {
    mp.isSupported.mockReturnValue(false);
    render(<FlvPlayerPanel roomId={1} file={file("回放 一.flv")} />);
    expect(await screen.findByText(/当前浏览器不支持在线播放/)).toBeTruthy();
    expect(mp.createPlayer).not.toHaveBeenCalled();
    const download = screen.getByRole("link", { name: /下载/ });
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
    );
  });

  it("控制栏含下载入口（href 指向录播文件、download 属性），不渲染播放区标题行", async () => {
    await renderPanel();
    const download = screen.getByRole("link", { name: "下载该场录播" });
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("回放 一.flv")}`,
    );
    expect(download.hasAttribute("download")).toBe(true);
    // 标题行（文件名）随边框/背景包裹一并移除
    expect(screen.queryByText("回放 一.flv")).toBeNull();
    expect(screen.queryByRole("button", { name: "关闭播放区" })).toBeNull();
  });
});

describe("FlvPlayerPanel seek", () => {
  it("已缓冲落点直接写 currentTime，不触发 seekUnbuffered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    await renderPanel();
    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    setVideo(video, { duration: 120, currentTime: 0, buffered: true });
    await act(async () => {
      fireEvent.loadedMetadata(video);
    });
    const progress = screen.getByRole("slider", { name: "播放进度" }) as HTMLInputElement;
    await vi.waitFor(() => expect(progress.disabled).toBe(false));
    await act(async () => {
      fireEvent.change(progress, { target: { value: "60" } });
    });
    expect(video.currentTime).toBe(60);
    expect(sk.seekUnbuffered).not.toHaveBeenCalled();
  });

  it("未缓冲落点调用 seekUnbuffered 且展示缓冲反馈", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 206, headers: { get: () => null }, body: { cancel: async () => {} } }),
    );
    let resolveSeek!: (value: boolean) => void;
    sk.seekUnbuffered.mockImplementation(() => new Promise<boolean>((resolve) => (resolveSeek = resolve)));
    await renderPanel();
    const video = screen.getByLabelText("录播视频") as HTMLVideoElement;
    setVideo(video);
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
    expect(screen.getByRole("status")).toBeTruthy();
    await act(async () => {
      resolveSeek(true);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("FlvPlayerPanel 全屏", () => {
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
  });

  it("非受控：网页全屏铺满视口并锁定滚动，ESC 退出", async () => {
    await renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    const container = screen.getByLabelText("录播播放区").querySelector("[data-fullscreen-container]") as HTMLElement;
    expect(container.className).toContain("fixed");
    expect(container.className).toContain("z-50");
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(screen.getByRole("button", { name: "网页全屏" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
  });

  it("非受控：点「全屏」请求容器全屏，fullscreenchange 复位", async () => {
    await renderPanel();
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

  it("全屏时控制栏悬浮于视频容器内，静止数秒后自动隐藏、鼠标移动再显现", async () => {
    await renderPanel();
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
      });
      const controls = screen.getByTestId("fullscreen-controls");
      // 进入全屏先显示
      expect(controls.className).toContain("opacity-100");
      // 悬浮于视频容器内（视频 wrapper 的绝对定位子节点）
      expect(controls.parentElement?.querySelector("video")).toBeTruthy();

      // 静止 3s 后自动隐藏
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(controls.className).toContain("opacity-0");

      // 鼠标在视频上移动 → 重新显现
      fireEvent.mouseMove(controls.parentElement as HTMLElement);
      expect(controls.className).toContain("opacity-100");
    } finally {
      vi.useRealTimers();
    }
  });

  it("受控模式：按外部 mode 渲染按钮并回调 onNativeToggle/onWebToggle，不自持 body 锁", async () => {
    const onNativeToggle = vi.fn();
    const onWebToggle = vi.fn();
    function Wrapper() {
      const nativeRef = useRef<HTMLDivElement>(null);
      return (
        <FlvPlayerPanel
          roomId={1}
          file={file("回放 一.flv")}
          fullscreen={{ mode: "none", nativeAvailable: true, onNativeToggle, onWebToggle, containerRef: nativeRef }}
        />
      );
    }
    render(<Wrapper />);
    await screen.findByLabelText("录播视频");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "全屏" }));
      fireEvent.click(screen.getByRole("button", { name: "网页全屏" }));
    });
    expect(onNativeToggle).toHaveBeenCalledTimes(1);
    expect(onWebToggle).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");
  });
});
