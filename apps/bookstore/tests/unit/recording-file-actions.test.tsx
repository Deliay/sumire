// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import RecordingFileActions from "@/features/recordings/RecordingFileActions";

const h = vi.hoisted(() => ({
  recordingFileUrl: vi.fn(
    (roomId: number, name: string) =>
      `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
  ),
  recordingReplayHref: vi.fn(
    (roomId: number, name: string) => `/recordings/replay?roomId=${roomId}&file=${encodeURIComponent(name)}`,
  ),
}));

vi.mock("@/features/recordings/api", () => ({
  recordingFileUrl: h.recordingFileUrl,
  recordingReplayHref: h.recordingReplayHref,
}));

const file = { name: "中文 名.flv", size: 1024, createdAt: "2026-09-01T00:00:00.000Z" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("录播文件项操作按钮组", () => {
  it("「播放」为回放页新标签页链接（target/rel/href）", () => {
    render(<RecordingFileActions roomId={1} file={file} />);
    const play = screen.getByRole("link", { name: /播放/ });
    expect(play.getAttribute("href")).toBe(`/recordings/replay?roomId=1&file=${encodeURIComponent(file.name)}`);
    expect(play.getAttribute("target")).toBe("_blank");
    expect(play.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByRole("button", { name: /播放|收起/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /下载/ })).toBeNull();
  });

  it("点 ▾ 展开菜单：菜单内「下载」为编码 URL 的 download 链接", () => {
    render(<RecordingFileActions roomId={1} file={file} />);
    const caret = screen.getByRole("button", { name: "更多操作" });
    expect(caret.getAttribute("aria-haspopup")).toBe("menu");
    expect(caret.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(caret);
    expect(screen.getByRole("button", { name: "更多操作" }).getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("menu");
    const download = screen.getByRole("menuitem", { name: /下载/ });
    expect(menu.contains(download)).toBe(true);
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent("中文 名.flv")}`,
    );
    expect(download.getAttribute("download")).not.toBeNull();
  });

  it("再次点 ▾ / 点击容器外 / 按 Esc 三种路径均关闭菜单", () => {
    render(<RecordingFileActions roomId={1} file={file} />);
    const caret = screen.getByRole("button", { name: "更多操作" });

    fireEvent.click(caret);
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.click(caret);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(caret);
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(caret);
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("点击菜单内「下载」后菜单关闭（原生下载行为不触发真实下载）", () => {
    render(<RecordingFileActions roomId={1} file={file} />);
    fireEvent.click(screen.getByRole("button", { name: "更多操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /下载/ }));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
