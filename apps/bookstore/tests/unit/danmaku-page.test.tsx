// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LiveEvent } from "@/features/danmaku/types";
import type { Role } from "@/features/backdoor/api";
import { COLUMN_PRESETS, COLUMNS_STORAGE_KEY } from "@/features/danmaku/columns";

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

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null };
const DM_EVENT: LiveEvent = {
  eventId: "dm:1",
  type: "danmaku",
  content: "弹幕一",
  occurredAt: "2026-08-16T12:00:00.000Z",
  sender: SENDER,
  read: false,
};

/** 按查询字符串返回对应 matches 的 matchMedia 桩（供 useMediaQuery 视口档位测试）。 */
function stubMatchMedia(matchesMap: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: matchesMap[query] ?? false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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
    vi.unstubAllGlobals();
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

describe("DanmakuPage 视图栏选择器", () => {
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
    vi.unstubAllGlobals();
  });

  it("narrow(<640) 页头不显示「视图栏」选择器", async () => {
    stubMatchMedia({ "(max-width: 639px)": true, "(min-width: 1024px)": false });
    render(<DanmakuPage />);
    await screen.findByRole("button", { name: "全屏模式" });
    expect(screen.queryByRole("combobox", { name: "视图栏" })).toBeNull();
  });

  it("medium(640-1023) 选择器仅 1/2 栏，默认 1 栏，与「全屏模式」同排", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": false });
    render(<DanmakuPage />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["1 栏", "2 栏"]);
    expect(select.value).toBe("1");
    expect(screen.getByRole("button", { name: "全屏模式" })).toBeTruthy();
  });

  it("medium 选择 2 栏后按预设分组（上船+SC | 礼物+弹幕）并持久化", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": false });
    render(<DanmakuPage />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });

    expect(await screen.findByText("上船 + SC")).toBeTruthy();
    expect(screen.getByText("礼物 + 弹幕")).toBeTruthy();

    const stored = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    expect(stored).toEqual(COLUMN_PRESETS[2]);
  });

  it("wide(>=1024) 选择器仅 2/3 栏，默认 3 栏", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    render(<DanmakuPage />);

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["2 栏", "3 栏"]);
    expect(select.value).toBe("3");
  });

  it("wide 选择 2 栏后切换为 2 栏预设并持久化", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    render(<DanmakuPage />);
    expect(await screen.findByText("弹幕一")).toBeTruthy();

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });

    expect(await screen.findByText("上船 + SC")).toBeTruthy();
    const stored = JSON.parse(window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    expect(stored).toEqual(COLUMN_PRESETS[2]);
  });

  it("全屏后「视图栏」选择器与「退出全屏」同排且仍可用", async () => {
    stubMatchMedia({ "(max-width: 639px)": false, "(min-width: 1024px)": true });
    render(<DanmakuPage />);
    fireEvent.click(await screen.findByRole("button", { name: "全屏模式" }));
    expect(await screen.findByRole("button", { name: "退出全屏" })).toBeTruthy();

    const select = (await screen.findByRole("combobox", { name: "视图栏" })) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });
    expect(await screen.findByText("上船 + SC")).toBeTruthy();
  });
});
