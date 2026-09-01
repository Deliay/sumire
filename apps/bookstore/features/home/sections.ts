/** 首页整页滚动站序列注册表（导航/指示器/容器单一事实源）。纯数据 + 类型。 */

export type SectionId =
  | "hero"
  | "archive-1"
  | "archive-2"
  | "archive-3"
  | "archive-4"
  | "archive-5"
  | "calendar"
  | "assets";

export type NavKey = "home" | "archive" | "calendar" | "assets";

export interface SectionDef {
  id: SectionId;
  /** 锚点 hash（含 #）。 */
  hash: string;
  /** 导航选中态归属的模块键。 */
  navKey: NavKey;
  title: string;
  /** 所属父模块（档案 5 站为 "archive"）。 */
  parent?: "archive";
}

export const ARCHIVE_TITLES: { id: SectionId; title: string }[] = [
  { id: "archive-1", title: "信息 · Profile" },
  { id: "archive-2", title: "设定 · Story" },
  { id: "archive-3", title: "喜好 · Taste" },
  { id: "archive-4", title: "历程 · Journey" },
  { id: "archive-5", title: "轶闻 · Trivia" },
];

export const SECTIONS: SectionDef[] = [
  { id: "hero", hash: "#hero", navKey: "home", title: "首页" },
  ...ARCHIVE_TITLES.map((a) => ({
    id: a.id,
    hash: `#${a.id}`,
    navKey: "archive" as const,
    title: a.title,
    parent: "archive" as const,
  })),
  { id: "calendar", hash: "#calendar", navKey: "calendar", title: "日历" },
  { id: "assets", hash: "#assets", navKey: "assets", title: "素材" },
];

/** 按是否配置 API 过滤日历站后的可见站序列（false 收敛为 7 站）。 */
export function visibleSections(apiConfigured: boolean): SectionDef[] {
  return SECTIONS.filter((s) => s.id !== "calendar" || apiConfigured);
}