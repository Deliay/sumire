// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import NavBar from "@/components/NavBar";
import type { ToolModule } from "@/lib/tools/registry";

let configured = true;
let recordingsConfigured = true;
let mockPathname = "/";

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
  },
}));

vi.mock("@/features/recordings/api", () => ({
  get RECORDINGS_CONFIGURED() {
    return recordingsConfigured;
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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
    mockPathname = "/";
  });

  beforeEach(() => {
    configured = true;
    recordingsConfigured = true;
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

  it("SECTION_CHANGE_EVENT 同步选中态（deck replaceState 翻页后）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      window.dispatchEvent(
        new CustomEvent("sumire:section-change", { detail: { navKey: "assets" } }),
      );
    });
    const assets = screen.getByRole("link", { name: "素材" });
    expect(assets.getAttribute("aria-current")).toBe("page");
    const home = screen.getByRole("link", { name: "主页" });
    expect(home.getAttribute("aria-current")).not.toBe("page");
  });

  it("首页内点击导航派发 NAVIGATE_EVENT（deck 经此翻页，pushState 不触发 hashchange）", () => {
    const spy = vi.fn();
    window.addEventListener("sumire:navigate", spy);
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "档案" }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls.at(-1)![0] as CustomEvent).detail;
    expect(detail.id).toBe("archive-1");
    window.removeEventListener("sumire:navigate", spy);
  });

  it("非首页路由仅对应项高亮（/about 只亮档案），href 仍为锚点", () => {
    mockPathname = "/about";
    render(<NavBar siteName="枝堇" tools={tools} />);
    const archive = screen.getByRole("link", { name: "档案" });
    // href 恒为锚点（非首页也指向首页锚点，deck 挂载时 hash 直落定位）
    expect(archive.getAttribute("href")).toBe("/#archive-1");
    expect(archive.getAttribute("aria-current")).toBe("page");
    // 其余不亮
    for (const label of ["主页", "素材", "日历"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("aria-current")).not.toBe("page");
    }
  });

  it("非首页锚点 href 恒为锚点（/calendar 页 href 仍为 /#calendar）", () => {
    mockPathname = "/calendar";
    render(<NavBar siteName="枝堇" tools={tools} />);
    const calendar = screen.getByRole("link", { name: "日历" });
    expect(calendar.getAttribute("href")).toBe("/#calendar");
    expect(calendar.getAttribute("aria-current")).toBe("page");
  });

  it("未配置 API 无「日历」项", () => {
    configured = false;
    vi.resetModules();
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.queryByRole("link", { name: "日历" })).toBeNull();
    expect(screen.getByRole("link", { name: "档案" })).toBeTruthy();
  });

  it("API 已配置时渲染「棉花糖」独立路由入口，href=/topics 且 /topics 高亮（round 9）", () => {
    mockPathname = "/topics";
    render(<NavBar siteName="枝堇" tools={tools} />);
    const topics = screen.getByRole("link", { name: "棉花糖" });
    // 独立路由，非首页锚点
    expect(topics.getAttribute("href")).toBe("/topics");
    expect(topics.getAttribute("aria-current")).toBe("page");
  });

  it("非 /topics 路径下「棉花糖」不高亮", () => {
    mockPathname = "/about";
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(
      screen.getByRole("link", { name: "棉花糖" }).getAttribute("aria-current"),
    ).not.toBe("page");
  });

  it("未配置 API 无「棉花糖」项", () => {
    configured = false;
    vi.resetModules();
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.queryByRole("link", { name: "棉花糖" })).toBeNull();
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

describe("导航「录播」入口", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
    mockPathname = "/";
  });

  beforeEach(() => {
    configured = true;
    recordingsConfigured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    window.scrollY = 0;
  });

  it("渲染「录播」项，href=/recordings（独立路由）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    const link = screen.getByRole("link", { name: "录播" });
    expect(link.getAttribute("href")).toBe("/recordings");
  });

  it("/recordings 下选中，其他路由下不选中", () => {
    mockPathname = "/recordings";
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.getByRole("link", { name: "录播" }).getAttribute("aria-current")).toBe("page");

    cleanup();
    mockPathname = "/about";
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.getByRole("link", { name: "录播" }).getAttribute("aria-current")).not.toBe("page");
  });

  it("未配置录播服务时无「录播」项", () => {
    recordingsConfigured = false;
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.queryByRole("link", { name: "录播" })).toBeNull();
  });

  it("首页内点击「录播」不派发 sumire:navigate（独立路由跳转）", () => {
    const spy = vi.fn();
    window.addEventListener("sumire:navigate", spy);
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "录播" }));
    });
    expect(spy).toHaveBeenCalledTimes(0);
    window.removeEventListener("sumire:navigate", spy);
  });

  it("移动端菜单项 href 与桌面一致（双份渲染）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      (screen.getByRole("button", { name: "打开菜单" }) as HTMLButtonElement).click();
    });
    const links = screen.getAllByRole("link", { name: "录播" });
    expect(links.length).toBeGreaterThan(1);
    links.forEach((link) => expect(link.getAttribute("href")).toBe("/recordings"));
  });
});

describe("导航不再出现「小密室」", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
    mockPathname = "/";
  });

  beforeEach(() => {
    configured = true;
    recordingsConfigured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    window.scrollY = 0;
  });

  it("桌面端与移动端菜单均无「小密室」链接", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.queryByRole("link", { name: "小密室" })).toBeNull();
    act(() => {
      (screen.getByRole("button", { name: "打开菜单" }) as HTMLButtonElement).click();
    });
    expect(screen.queryByRole("link", { name: "小密室" })).toBeNull();
  });
});