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
  /** 位置指示器短标签（纯中文，不含英文与「·」）。 */
  railLabel: string;
  /** 所属父模块（档案 5 站为 "archive"）。 */
  parent?: "archive";
}

export const ARCHIVE_TITLES: { id: SectionId; title: string; railLabel: string }[] = [
  { id: "archive-1", title: "信息 · Profile", railLabel: "信息" },
  { id: "archive-2", title: "设定 · Story", railLabel: "设定" },
  { id: "archive-3", title: "喜好 · Taste", railLabel: "喜好" },
  { id: "archive-4", title: "历程 · Journey", railLabel: "历程" },
  { id: "archive-5", title: "轶闻 · Trivia", railLabel: "轶闻" },
];

export const SECTIONS: SectionDef[] = [
  { id: "hero", hash: "#hero", navKey: "home", title: "首页", railLabel: "首页" },
  ...ARCHIVE_TITLES.map((a) => ({
    id: a.id,
    hash: `#${a.id}`,
    navKey: "archive" as const,
    title: a.title,
    railLabel: a.railLabel,
    parent: "archive" as const,
  })),
  { id: "calendar", hash: "#calendar", navKey: "calendar", title: "日历", railLabel: "日历" },
  { id: "assets", hash: "#assets", navKey: "assets", title: "素材", railLabel: "素材" },
];

/** 按是否配置 API 过滤日历站后的可见站序列（false 收敛为 7 站）。 */
export function visibleSections(apiConfigured: boolean): SectionDef[] {
  return SECTIONS.filter((s) => s.id !== "calendar" || apiConfigured);
}

/** 首页整页滚动站切换事件名（deck → NavBar 选中态同步，replaceState 不触发 hashchange 故用自定义事件）。 */
export const SECTION_CHANGE_EVENT = "sumire:section-change";

/** 站切换事件载荷。 */
export interface SectionChangeDetail {
  /** 当前站的 navKey（首页/档案/日历/素材）。 */
  navKey: NavKey;
}

/** 首页内导航锚点点击事件名（NavBar → deck 请求翻页；Next Link pushState 不触发 hashchange）。 */
export const NAVIGATE_EVENT = "sumire:navigate";

/** 导航事件载荷。 */
export interface NavigateDetail {
  /** 目标站 id。 */
  id: SectionId;
}