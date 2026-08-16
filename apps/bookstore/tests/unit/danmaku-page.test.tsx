// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  });

  it("页头同一行结尾渲染「全屏模式」按钮", async () => {
    render(<DanmakuPage />);
    const btn = await screen.findByRole("button", { name: "全屏模式" });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("点击后以 fixed 遮罩占满网页窗口，出现「退出全屏」按钮", async () => {
    render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    const overlay = document.querySelector('[data-testid="danmaku-fullscreen"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    const exitBtn = await screen.findByRole("button", { name: "退出全屏" });
    expect(exitBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "全屏模式" })).toBeNull();
  });

  it("再次点击退出全屏，恢复页头按钮", async () => {
    render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    fireEvent.click(await screen.findByRole("button", { name: "退出全屏" }));
    expect(await screen.findByRole("button", { name: "全屏模式" })).toBeTruthy();
    expect(document.querySelector('[data-testid="danmaku-fullscreen"]')).toBeNull();
  });

  it("全屏后分栏数据仍正常渲染", async () => {
    render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    expect(await screen.findByText("弹幕一")).toBeTruthy();
  });
});
