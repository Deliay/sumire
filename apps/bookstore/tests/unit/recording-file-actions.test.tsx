// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import RecordingFileActions from "@/features/recordings/RecordingFileActions";

const h = vi.hoisted(() => ({
  recordingFileUrl: vi.fn(
    (roomId: number, name: string) =>
      `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
  ),
}));

vi.mock("@/features/recordings/api", () => ({
  recordingFileUrl: h.recordingFileUrl,
}));

const file = { name: "中文 名.flv", size: 1024, createdAt: "2026-09-01T00:00:00.000Z" };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("录播文件项操作按钮组", () => {
  it("渲染：主按钮文案随 open 同步、下拉开关带 ARIA，默认无「下载」链接", () => {
    const { rerender } = render(
      <RecordingFileActions roomId={1} file={file} open={false} onToggleFile={vi.fn()} />,
    );

    const play = screen.getByRole("button", { name: /播放/ });
    expect(play.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: /下载/ })).toBeNull();

    const caret = screen.getByRole("button", { name: "更多操作" });
    expect(caret.getAttribute("aria-haspopup")).toBe("menu");
    expect(caret.getAttribute("aria-expanded")).toBe("false");

    rerender(<RecordingFileActions roomId={1} file={file} open onToggleFile={vi.fn()} />);
    const collapse = screen.getByRole("button", { name: /收起/ });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
  });

  it("主按钮点击调用 onToggleFile(file) 一次（纯受控）", () => {
    const onToggleFile = vi.fn();
    render(<RecordingFileActions roomId={1} file={file} open={false} onToggleFile={onToggleFile} />);

    fireEvent.click(screen.getByRole("button", { name: /播放/ }));
    expect(onToggleFile).toHaveBeenCalledTimes(1);
    expect(onToggleFile).toHaveBeenCalledWith(file);
  });

  it("点 ▾ 展开菜单：菜单内「下载」为编码 URL 的 download 链接，开关 aria-expanded 置真", () => {
    render(<RecordingFileActions roomId={1} file={file} open={false} onToggleFile={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多操作" }));
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
    render(<RecordingFileActions roomId={1} file={file} open={false} onToggleFile={vi.fn()} />);
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
    render(<RecordingFileActions roomId={1} file={file} open={false} onToggleFile={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /下载/ }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("open 由 true 翻回 false 后按钮文案复位为「播放」（纯受控契约）", () => {
    const onToggleFile = vi.fn();
    const { rerender } = render(
      <RecordingFileActions roomId={1} file={file} open onToggleFile={onToggleFile} />,
    );
    expect(screen.getByRole("button", { name: /收起/ })).toBeTruthy();

    rerender(
      <RecordingFileActions roomId={1} file={file} open={false} onToggleFile={onToggleFile} />,
    );
    expect(screen.getByRole("button", { name: /播放/ })).toBeTruthy();
  });
});
