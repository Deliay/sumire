// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";

const listLiveEvents = vi.fn();
vi.mock("@/features/danmaku/api", () => ({
  listLiveEvents: (...args: unknown[]) => listLiveEvents(...args),
  markLiveEventRead: vi.fn(async () => ({ status: 200, data: { ok: true } })),
  markLiveEventUnread: vi.fn(async () => ({ status: 200, data: { ok: true } })),
  markAllLiveEventsRead: vi.fn(async () => ({ status: 200, data: { ok: true, marked: 1 } })),
}));

vi.mock("@/features/backdoor/session", () => ({
  useSession: () => ({
    session: {
      status: "authenticated",
      me: { ok: true, username: "u", role: "admin", mustChangePassword: false },
    },
    refresh: vi.fn(),
    clear: vi.fn(),
  }),
}));

// 捕获 SSE 回调，手动投递实时事件
let streamHandler: ((event: LiveEvent) => void) | null = null;
vi.mock("@/features/danmaku/useLiveEventStream", () => ({
  useLiveEventStream: (_types: unknown, onEvent: (event: LiveEvent) => void) => {
    streamHandler = onEvent;
    return "open";
  },
}));

import DanmakuDashboard from "@/features/danmaku/components/DanmakuDashboard";

const SENDER: LiveEvent["sender"] = {
  uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null,
};

function makeEvent(partial: Partial<LiveEvent> & Pick<LiveEvent, "eventId" | "type">): LiveEvent {
  return { occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, ...partial };
}

describe("DanmakuDashboard 入场动效（F1）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(min-width: 1024px)",
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    // jsdom 无布局：stub 固定尺寸供 virtualizer 实测
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
    listLiveEvents.mockImplementation(async () => ({
      status: 200,
      data: { total: 0, page: 1, pageSize: 50, items: [] },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    streamHandler = null;
  });

  it("SSE 弹幕到达后新行挂 animate-danmaku-enter", async () => {
    render(<DanmakuDashboard />);
    await screen.findAllByText("暂无事件");
    expect(streamHandler).not.toBeNull();

    act(() => {
      streamHandler!(makeEvent({ eventId: "dm:new-1", type: "danmaku", content: "新弹幕一" }));
    });

    expect(await screen.findByText("新弹幕一")).toBeTruthy();
    expect(document.querySelectorAll(".animate-danmaku-enter").length).toBeGreaterThan(0);
  });
});
