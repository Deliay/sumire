// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ReplayApp from "@/features/recordings/replay/ReplayApp";

const h = vi.hoisted(() => ({
  recordingsConfigured: true,
  getRoomRecordings: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => h.searchParams }));

vi.mock("@/features/recordings/api", () => ({
  get RECORDINGS_CONFIGURED() {
    return h.recordingsConfigured;
  },
  getRoomRecordings: h.getRoomRecordings,
  recordingFileUrl: (roomId: number, name: string) =>
    `https://rec.example.com/api/b/live/${roomId}/recordings/${encodeURIComponent(name)}`,
}));

vi.mock("@/features/recordings/replay/ReplayStage", () => ({
  default: ({ roomId, file }: { roomId: number; file: { name: string } }) => (
    <div data-testid="stage">
      stage:{roomId}:{file.name}
    </div>
  ),
}));

const FILE = { name: "中文 回放.flv", size: 2048, createdAt: "2026-09-17T10:00:00.000Z" };

beforeEach(() => {
  h.recordingsConfigured = true;
  h.getRoomRecordings.mockReset();
  h.getRoomRecordings.mockResolvedValue({ ok: true, files: [FILE] });
  h.searchParams = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ReplayApp 参数校验与空态", () => {
  it("缺 roomId/file：参数无效空态 + 返回录播页链接，且不发请求", async () => {
    render(<ReplayApp />);
    expect(await screen.findByText(/参数无效/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /返回录播列表/ }).getAttribute("href")).toBe("/recordings");
    expect(h.getRoomRecordings).not.toHaveBeenCalled();
  });

  it("roomId 非法：参数无效空态", async () => {
    h.searchParams = new URLSearchParams({ roomId: "abc", file: "x.flv" });
    render(<ReplayApp />);
    expect(await screen.findByText(/参数无效/)).toBeTruthy();
    expect(h.getRoomRecordings).not.toHaveBeenCalled();
  });

  it("录播服务未配置：服务未配置空态，不发请求", async () => {
    h.recordingsConfigured = false;
    h.searchParams = new URLSearchParams({ roomId: "1", file: FILE.name });
    render(<ReplayApp />);
    expect(await screen.findByText(/服务未配置/)).toBeTruthy();
    expect(h.getRoomRecordings).not.toHaveBeenCalled();
  });

  it("文件在列表中查不到：录播不存在或已删除空态", async () => {
    h.getRoomRecordings.mockResolvedValue({ ok: true, files: [{ name: "别的.flv", size: 1, createdAt: FILE.createdAt }] });
    h.searchParams = new URLSearchParams({ roomId: "1", file: FILE.name });
    render(<ReplayApp />);
    expect(await screen.findByText(/录播不存在或已删除/)).toBeTruthy();
  });

  it("正常参数：回源匹配文件并渲染舞台与操作区", async () => {
    h.searchParams = new URLSearchParams({ roomId: "1", file: FILE.name });
    render(<ReplayApp />);

    await waitFor(() => expect(screen.getByTestId("stage")).toBeTruthy());
    expect(h.getRoomRecordings).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("stage").textContent).toContain(FILE.name);
    const download = screen.getByRole("link", { name: /下载该场录播/ });
    expect(download.getAttribute("href")).toBe(
      `https://rec.example.com/api/b/live/1/recordings/${encodeURIComponent(FILE.name)}`,
    );
    expect(screen.getByRole("link", { name: /返回录播列表/ }).getAttribute("href")).toBe("/recordings");
  });
});
