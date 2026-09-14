// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import NavBar from "@/components/NavBar";
import type { ToolModule } from "@/lib/tools/registry";

let configured = true;
let mockPathname = "/";

vi.mock("@/features/backdoor/api", () => ({
  get API_CONFIGURED() {
    return configured;
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

  it("移动端默认态即带背景模糊条件类，不再无条件透明", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    const header = document.querySelector("header") as HTMLElement;
    expect(header.className).toContain("max-md:bg-night/85");
    expect(header.className).toContain("max-md:backdrop-blur-md");
    expect(header.className).toContain("max-md:shadow-[0_1px_0_0_var(--color-vine)]");
    // 桌面端默认仍透明：不再使用无条件 bg-transparent
    expect(header.className).not.toContain("bg-transparent");
  });

  it("滚动后仍走既有雾化态（回归）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    window.scrollY = 100;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    const header = document.querySelector("header") as HTMLElement;
    expect(header.className).toContain("bg-night/85");
    expect(header.className).toContain("backdrop-blur-md");
  });

  it("菜单展开态仍走既有雾化态（回归）", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      (screen.getByRole("button", { name: "打开菜单" }) as HTMLButtonElement).click();
    });
    const header = document.querySelector("header") as HTMLElement;
    expect(header.className).toContain("bg-night/85");
    expect(header.className).toContain("backdrop-blur-md");
  });
});

describe("外链 小密室", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
    mockPathname = "/";
  });

  beforeEach(() => {
    configured = true;
    vi.stubGlobal("matchMedia", matchMediaStub);
    window.scrollY = 0;
  });

  it("渲染「小密室」链接：href、target、rel 正确", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    const link = screen.getByRole("link", { name: "小密室" });
    expect(link.getAttribute("href")).toBe("https://sumire.icu");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("首页任意 hash 下无 aria-current", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    const link = screen.getByRole("link", { name: "小密室" });
    expect(link.getAttribute("aria-current")).toBeNull();
    window.history.replaceState(null, "", "#archive-1");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("非首页路由下无 aria-current", () => {
    mockPathname = "/about";
    render(<NavBar siteName="枝堇" tools={tools} />);
    const link = screen.getByRole("link", { name: "小密室" });
    expect(link.getAttribute("aria-current")).toBeNull();
  });

  it("首页内点击「小密室」：无事件派发、hash 不变", () => {
    const spy = vi.fn();
    window.addEventListener("sumire:navigate", spy);
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "小密室" }));
    });
    expect(spy).toHaveBeenCalledTimes(0);
    expect(window.location.hash).toBe("");
    window.removeEventListener("sumire:navigate", spy);
  });

  it("移动端双份渲染且属性一致", () => {
    render(<NavBar siteName="枝堇" tools={tools} />);
    act(() => {
      (screen.getByRole("button", { name: "打开菜单" }) as HTMLButtonElement).click();
    });
    const mobileLinks = screen.getAllByRole("link", { name: "小密室" });
    expect(mobileLinks.length).toBe(2);
    mobileLinks.forEach((link) => {
      expect(link.getAttribute("href")).toBe("https://sumire.icu");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    });
  });

  it("configured = false 时「小密室」仍渲染", () => {
    configured = false;
    vi.resetModules();
    render(<NavBar siteName="枝堇" tools={tools} />);
    expect(screen.getByRole("link", { name: "小密室" })).toBeTruthy();
  });
});