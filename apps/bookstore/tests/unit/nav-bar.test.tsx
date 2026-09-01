// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import NavBar from "@/components/NavBar";
import type { ToolModule } from "@/lib/tools/registry";

let configured = true;

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const tools: ToolModule[] = [];

function matchMediaStub() {
  return { matches: false, media: "", addEventListener() {}, removeEventListener() {} };
}

describe("NavBar 锚点化", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  beforeEach(() => {
    configured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    // scrolled 初始 false：scrollY=0
    window.scrollY = 0;
  });

  it("BASE_LINKS 锚点形态 href（/#archive-1 等）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    const archive = screen.getByRole("link", { name: "档案" });
    expect(archive.getAttribute("href")).toBe("/#archive-1");
    const assets = screen.getByRole("link", { name: "素材" });
    expect(assets.getAttribute("href")).toBe("/#assets");
    const calendar = screen.getByRole("link", { name: "日历" });
    expect(calendar.getAttribute("href")).toBe("/#calendar");
  });

  it("hash 变化同步选中态（#archive-3 → 档案高亮）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    window.history.replaceState(null, "", "#archive-3");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    const archive = screen.getByRole("link", { name: "档案" });
    expect(archive.getAttribute("aria-current")).toBe("page");
    const home = screen.getByRole("link", { name: "主页" });
    expect(home.getAttribute("aria-current")).not.toBe("page");
  });

  it("未配置 API 无「日历」项", () => {
    configured = false;
    vi.resetModules();
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.queryByRole("link", { name: "日历" })).toBeNull();
    expect(screen.getByRole("link", { name: "档案" })).toBeTruthy();
  });

  it("移动端菜单项 href 与桌面一致", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      (screen.getByRole("button", { name: "打开菜单" }) as HTMLButtonElement).click();
    });
    const mobileArchive = screen.getAllByRole("link", { name: "档案" });
    expect(mobileArchive.length).toBeGreaterThan(1);
    mobileArchive.forEach((a) => expect(a.getAttribute("href")).toBe("/#archive-1"));
  });
});