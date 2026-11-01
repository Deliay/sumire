---
description: sumire 前端开发统一规范——技术栈、目录约定、设计系统 token、组件与测试规范
type: Permanent
---

# 前端开发规范

本文件是 sumire 前端开发的统一约定，开发前必须加载。视觉规则见 [[../design/01-visual-identity.md]]，页面规则见 [[../design/02-page-design.md]]。前端项目位于 monorepo 的 `apps/bookstore/`，下文目录均为该目录内的相对路径。

## 技术栈

- Next.js（App Router）+ React + TypeScript（strict），全部页面静态生成（SSG）
- Tailwind CSS v4，设计 token 定义在 `app/globals.css` 的 `@theme`
- 内容：仓库内 YAML（`content/`）+ Zod 校验（`lib/content/`）
- 测试：Vitest（单元）+ Playwright（E2E），包管理 pnpm workspace

## 常用命令

```bash
pnpm dev          # 本地开发
pnpm build        # 生成缩略图 + 生产构建
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试
pnpm lint         # ESLint
pnpm thumbnails   # 重新生成素材缩略图
```

## 目录约定

| 目录 | 职责 |
|------|------|
| `app/` | 路由与页面组装，不写业务逻辑 |
| `features/<模块>/` | 页面/工具的业务组件 |
| `components/ui/` | 基础组件：`Button / Field / Tag / Surface / Notice / Plate / Rule / EmptyState` |
| `components/layout/` | 版式组件：`PageShell / PageHeader / SectionHeader` |
| `components/patterns/` | 组合模式：`Timeline` |
| `lib/content/` | 内容加载（`index.ts` 仅服务端可用） |
| `lib/content/shared.ts` | 客户端安全的类型与工具函数（禁止引入 Node API） |
| `lib/useFocusTrap.ts` | 弹层/抽屉焦点陷阱（`focusablesIn` 纯函数 + hook） |
| `lib/cn.ts` | 类名合并 |
| `lib/tools/registry.ts` | 工具注册表，新工具在此注册 |
| `content/` | 站点数据 YAML，修改走 PR |
| `public/assets/` | `original/` 原图 + `thumbnails/` 生成物 |
| `tests/unit/` `tests/e2e/` | 测试 |

## 设计系统约定

- 只使用 `@theme` token，禁止硬编码色值 / 圆角 / 时长。
- 颜色：`night / raised / soft / line / line-strong / ink / ink-dim / ink-mute / paper / paper-dim / ink-on-paper / primary / primary-deep / flower / eye / crimson / gold`；`vine` 已删除。
- 字体：`font-serif` 标题与长文、`font-sans` 界面、`font-display` 仅字标/图版编号/卷次、`font-mono` 元数据。
- 字阶：`text-display / h1 / h2 / h3 / body / small / label / tiny`；`text-label` 配 `tracking-label`。
- 圆角只用 `rounded-xs`（2px）/ `rounded-sm`（4px）/ `rounded-md`（8px）/ `rounded-pill`（仅状态药丸）。
- 阴影仅弹层 `shadow-overlay`；卡片、按钮、导航无阴影；不写 `shadow-[0_0_…]` 泛光。
- 结构线 1px `border-line`，控件边界 `border-line-strong`。
- 焦点：全局 `:focus-visible` 2px `flower` + 2px offset；组件不得裁剪焦点环。
- 触摸目标 ≥44×44；弹层 / 抽屉统一 `useFocusTrap`，Esc 关闭、锁定滚动、关闭后焦点归还。
- 动效只保留入场、悬停、翻页、弹层；**全站（含公开站）尊重 `prefers-reduced-motion`**（`globals.css` 全局兜底），不再有氛围层例外。
- 不新增装饰性 SVG / Canvas / 视差 / 环境循环动效。

## 组件规范

- 默认 Server Component；仅交互组件（菜单、复制、Lightbox、筛选、抽屉）标 `"use client"`。
- Client Component 禁止 import `lib/content/index.ts`（含 `node:fs`），用 `lib/content/shared.ts`。
- 业务组件不重复实现按钮 / 输入 / 空态 / 标签 / 图版，必须复用 `components/ui/`。
- 公开页统一 `PageShell` + `PageHeader` / `SectionHeader`；每页唯一 `h1`，章节 `h2`，卡片标题 `h3`。
- 图片统一用 `next/image` 与 `Plate`（固定尺寸防 CLS）；装饰图形 `aria-hidden`。

## 内容规范

- 新增/修改档案信息必须来自官方公开信息，禁止二次设定。
- 新增素材：原图放 `public/assets/original/`，在 `content/assets.yaml` 登记，跑一次 `pnpm thumbnails`。
- 文案零改动（视觉重设计不改变内容语义）。

## 测试规范

- 遵循 TDD：先写失败测试再实现（参考 `tdd` skill）。
- `lib/` 与内容层必须有单元测试；新页面 / 关键交互补 E2E。
- 组件测试只断言结构、可访问性与状态类名，不断言像素；视觉验收走截图。
- 提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

## 分支与提交

- 分支：`<type>/<slug>`（`feat/` 开发、`prd/` 文档），禁止 rebase/squash，只 merge。
- 提交信息：`<type>: <描述>`，与仓库现有风格一致。

## 相关文档

- 视觉识别：[[../design/01-visual-identity.md]]
- 页面设计：[[../design/02-page-design.md]]
- 后台设计：[[../design/03-backdoor-design.md]]
- 技术方案：[[proposals/2026-11-01-visual-system-redesign-proposal.md]]
- PRD：[[../product/requirements/draft/2026-11-01-visual-system-redesign-prd.md]]
