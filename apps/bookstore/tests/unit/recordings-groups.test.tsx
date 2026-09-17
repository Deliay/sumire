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
  recordingReplayHref: vi.fn(
    (roomId: number, name: string) => `/recordings/replay?roomId=${roomId}&file=${encodeURIComponent(name)}`,
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
  recordingReplayHref: h.recordingReplayHref,
}));

vi.mock("mpegts.js", () => ({
  default: {
    createPlayer: vi.fn(() => ({
      destroy: vi.fn(),
      attachMediaElement: vi.fn(),
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
    isSupported: vi.fn(() => true),
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

const file = (name: string, size: number, createdAt: string) => ({ name, size, createdAt });

beforeEach(() => {
  h.recordingsConfigured = true;
  h.getRecordingStatus.mockReset();
  h.getRoomRecordings.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("录播列表分组", () => {
  it("默认仅渲染分组头，未展开不请求录播列表", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇"), room(2, "另一间")] });
    render(<RecordingsApp />);

    expect(await screen.findByRole("button", { name: /枝堇/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /另一间/ })).toBeTruthy();
    expect(h.getRoomRecordings).not.toHaveBeenCalled();
  });

  it("展开拉取一次并渲染文件列表（createdAt 倒序、人性化大小），再次点击折叠；多分组可同时展开", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇"), room(2, "另一间")] });
    h.getRoomRecordings.mockImplementation(async (roomId: number) =>
      roomId === 1
        ? {
            ok: true,
            files: [
              file("旧.flv", 1024, "2026-09-01T00:00:00.000Z"),
              file("新.flv", 2048, "2026-09-10T00:00:00.000Z"),
            ],
          }
        : { ok: true, files: [file("b.flv", 512, "2026-09-05T00:00:00.000Z")] },
    );
    render(<RecordingsApp />);

    const room1 = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(room1);
    });
    expect(h.getRoomRecordings).toHaveBeenCalledTimes(1);
    expect(h.getRoomRecordings).toHaveBeenCalledWith(1);
    expect(screen.getByText("新.flv")).toBeTruthy();
    expect(screen.getByText("旧.flv")).toBeTruthy();
    expect(screen.getByText("2.0 KB")).toBeTruthy();
    // createdAt 倒序：新.flv 在 旧.flv 之前
    const names = screen.getAllByText(/\.flv$/).map((el) => el.textContent);
    expect(names.indexOf("新.flv")).toBeLessThan(names.indexOf("旧.flv"));

    // 再次点击折叠
    await act(async () => {
      fireEvent.click(room1);
    });
    expect(screen.queryByText("新.flv")).toBeNull();

    // 展开另一个分组
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /另一间/ }));
    });
    expect(h.getRoomRecordings).toHaveBeenCalledTimes(2);
    expect(screen.getByText("b.flv")).toBeTruthy();
  });

  it("已展开分组重复展开/折叠不重复请求", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇")] });
    h.getRoomRecordings.mockResolvedValue({ ok: true, files: [file("a.flv", 100, "2026-09-01T00:00:00.000Z")] });
    render(<RecordingsApp />);

    const header = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(header);
    });
    await act(async () => {
      fireEvent.click(header);
    });
    await act(async () => {
      fireEvent.click(header);
    });
    expect(h.getRoomRecordings).toHaveBeenCalledTimes(1);
  });

  it("分页：21 条首页 20 条 + 翻页本地 slice 不重复请求", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇")] });
    const files = Array.from({ length: 21 }, (_, i) =>
      file(`f${String(i + 1).padStart(2, "0")}.flv`, 100, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`),
    );
    h.getRoomRecordings.mockResolvedValue({ ok: true, files });
    render(<RecordingsApp />);

    const header = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(header);
    });
    expect(screen.getAllByText(/f\d+\.flv/)).toHaveLength(20);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    });
    expect(screen.getAllByText(/f\d+\.flv/)).toHaveLength(1);
    expect(h.getRoomRecordings).toHaveBeenCalledTimes(1);
  });

  it("分组加载失败仅本组展示错误与重试，重试成功后渲染", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇"), room(2, "另一间")] });
    h.getRoomRecordings
      .mockResolvedValueOnce({ ok: false, files: [] })
      .mockResolvedValueOnce({ ok: true, files: [file("恢复.flv", 100, "2026-09-01T00:00:00.000Z")] });
    render(<RecordingsApp />);

    const room1 = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(room1);
    });
    expect(screen.getByText(/加载失败/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试" }));
    });
    expect(screen.getByText("恢复.flv")).toBeTruthy();
    // 另一分组未受影响（仍为折叠态）
    expect(screen.getByRole("button", { name: /另一间/ })).toBeTruthy();
  });

  it("空列表：展开后展示「暂无录播」", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇")] });
    h.getRoomRecordings.mockResolvedValue({ ok: true, files: [] });
    render(<RecordingsApp />);

    const header = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(header);
    });
    expect(screen.getByText("暂无录播")).toBeTruthy();
  });

  it("文件名与「播放」均为回放页新标签页链接，列表内无内联播放器", async () => {
    h.getRecordingStatus.mockResolvedValue({ ok: true, items: [room(1, "枝堇")] });
    h.getRoomRecordings.mockResolvedValue({ ok: true, files: [file("回放.flv", 100, "2026-09-01T00:00:00.000Z")] });
    render(<RecordingsApp />);

    const header = await screen.findByRole("button", { name: /枝堇/ });
    await act(async () => {
      fireEvent.click(header);
    });

    const expectedHref = `/recordings/replay?roomId=1&file=${encodeURIComponent("回放.flv")}`;
    const play = screen.getByRole("link", { name: /播放/ });
    expect(play.getAttribute("href")).toBe(expectedHref);
    expect(play.getAttribute("target")).toBe("_blank");
    expect(play.getAttribute("rel")).toBe("noopener noreferrer");

    const nameLink = screen.getByRole("link", { name: "回放.flv" });
    expect(nameLink.getAttribute("href")).toBe(expectedHref);
    expect(nameLink.getAttribute("target")).toBe("_blank");

    // 内联手风琴播放器退场
    expect(screen.queryByLabelText("录播播放区")).toBeNull();
    expect(screen.queryByRole("button", { name: "收起" })).toBeNull();
  });
});
