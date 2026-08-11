/**
 * 工具注册表：每个工具是一个独立模块，在此注册后才会出现在导航与工具路由中。
 * V1 注册表为空——未上线的功能在 UI 中不存在（无占位）。
 * 注意：首个工具落地时需一并新增 app/tools/[slug]/page.tsx 分发页
 * （静态导出模式下空的 generateStaticParams 无法构建，故 V1 不保留该路由）。
 */
export interface ToolModule {
  /** 路由 slug，对应 /tools/<slug> */
  slug: string;
  /** 工具名称 */
  name: string;
  /** 一句话描述 */
  description: string;
  /** lucide 图标名 */
  icon: string;
}

const registry: ToolModule[] = [];

export function getTools(): ToolModule[] {
  return registry;
}

export function getTool(slug: string): ToolModule | undefined {
  return registry.find((tool) => tool.slug === slug);
}
