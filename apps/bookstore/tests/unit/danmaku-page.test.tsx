// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import type { Role } from "@/features/backdoor/api";

const listLiveEvents = vi.fn();
vi.mock("@/features/danmaku/api", () => ({
  listLiveEvents: (...args: unknown[]) => listLiveEvents(...args),
  markLiveEventRead: vi.fn(),
  markLiveEventUnread: vi.fn(),
  markAllLiveEventsRead: vi.fn(),
}));

let currentRole: Role = "admin";
vi.mock("@/features/backdoor/session", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      me: { ok: true, username: "u", role: currentRole, mustChangePassword: false },
    },
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

import DanmakuPage from "@/app/backdoor/(dashboard)/danmaku/page";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", face: null, medal: null };
const DM_EVENT: LiveEvent = {
  eventId: "dm:1",
  type: "danmaku",
  content: "弹幕一",
  occurredAt: "2026-08-16T12:00:00.000Z",
  sender: SENDER,
  read: false,
};

/** 模拟 Fullscreen API：requestFullscreen/exitFullscreen/fullscreenElement。 */
function mockFullscreen() {
  let fullscreenEl: Element | null = null;
  const request = vi.fn(() => {
    fullscreenEl = document.body;
    dispatchFullscreenChange();
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    fullscreenEl = null;
    dispatchFullscreenChange();
    return Promise.resolve();
  });
  function dispatchFullscreenChange() {
    document.dispatchEvent(new Event("fullscreenchange"));
  }
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenEl,
  });
  HTMLElement.prototype.requestFullscreen = request as typeof HTMLElement.prototype.requestFullscreen;
  document.exitFullscreen = exit as typeof document.exitFullscreen;
  return { request, exit };
}

describe("DanmakuPage 全屏模式", () => {
  beforeEach(() => {
    window.localStorage.clear();
    currentRole = "admin";
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
    listLiveEvents.mockImplementation(async (types: string[]) => {
      const items = [DM_EVENT].filter((e) => types.includes(e.type));
      return { status: 200, data: { total: items.length, page: 1, pageSize: 50, items } };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // 清掉 fullscreen 相关覆盖
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    Reflect.deleteProperty(document, "exitFullscreen");
  });

  it("页头同一行结尾渲染「全屏模式」按钮", async () => {
    render(<DanmakuPage />);
    const btn = await screen.findByRole("button", { name: "全屏模式" });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("点击后请求全屏，按钮切换为「退出全屏」", async () => {
    const { request } = mockFullscreen();
    render(<DanmakuPage />);
    const btn = await screen.findByRole("button", { name: "全屏模式" });
    fireEvent.click(btn);
    expect(request).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "退出全屏" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("再次点击退出全屏", async () => {
    const { exit } = mockFullscreen();
    render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    fireEvent.click(await screen.findByRole("button", { name: "退出全屏" }));
    expect(exit).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "全屏模式" })).toBeTruthy();
  });

  it("全屏时分栏容器使用占满整屏的布局类", async () => {
    mockFullscreen();
    const { container } = render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    await act(async () => {});
    const fullscreenBox = container.querySelector(".overflow-hidden") as HTMLElement;
    expect(fullscreenBox).not.toBeNull();
    const danmakuFeed = await screen.findByText("弹幕一");
    expect(danmakuFeed).toBeTruthy();
  });
});
