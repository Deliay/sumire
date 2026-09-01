---
description: sumire 前端开发统一规范——技术栈、目录约定、组件与测试规范
type: Permanent
---

# 前端开发规范

本文件是 sumire 前端开发的统一约定，开发前必须加载。视觉规则见 [[../design/01-visual-identity.md]]，页面规则见 [[../design/02-page-design.md]]。前端项目位于 monorepo 的 `apps/bookstore/`，下文目录均为该目录内的相对路径。

## 技术栈

- Next.js（App Router）+ React + TypeScript（strict），全部页面静态生成（SSG）
- Tailwind CSS v4，设计 token 定义在 `app/globals.css` 的 `@theme` 中
- 内容：仓库内 YAML（`content/`）+ Zod 校验（`lib/content/`）
- 测试：Vitest（单元）+ Playwright（E2E），包管理 pnpm workspace

## 常用命令

在 `apps/bookstore/` 目录下执行：

```bash
pnpm dev          # 本地开发
pnpm build        # 生成缩略图 + 生产构建
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试（自动起 dev server）
pnpm lint         # ESLint
pnpm thumbnails   # 重新生成素材缩略图
```

## 目录约定

| 目录 | 职责 |
|------|------|
| `app/` | 路由与页面组装，不写业务逻辑 |
| `features/<模块>/` | 页面/工具的业务组件 |
| `components/` | 设计系统组件，无业务逻辑 |
| `lib/content/` | 内容加载（`index.ts` 仅服务端可用） |
| `lib/content/shared.ts` | 客户端安全的类型与工具函数（禁止引入 Node API） |
| `lib/tools/registry.ts` | 工具注册表，新工具在此注册 |
| `content/` | 站点数据 YAML，修改走 PR |
| `public/assets/` | `original/` 原图 + `thumbnails/` 生成物 |
| `tests/unit/` `tests/e2e/` | 测试 |

## 组件规范

- 默认 Server Component；仅交互组件（菜单、复制、Lightbox、筛选）标 `"use client"`
- Client Component 禁止 import `lib/content/index.ts`（含 `node:fs`），用 `lib/content/shared.ts`
- 样式只用 `@theme` 中的 token 色（`night/raised/soft/paper/ink/flower/vine/eye/primary`），禁止散落硬编码色值
- 氛围动效必须尊重 `prefers-reduced-motion`（例外：公开站氛围层——首页雾气/藤蔓/视差/粒子/翻页转场与冲量为展示向特批口径不降级，见 design 01 §5；后台 `/backdoor` 仍严格执行本规范）

## 内容规范

- 新增/修改档案信息必须来自官方公开信息，禁止二次设定
- 新增素材：原图放 `public/assets/original/`，在 `content/assets.yaml` 登记，跑一次 `pnpm thumbnails`

## 测试规范

- 遵循 TDD：先写失败测试再实现（参考 `tdd` skill）
- `lib/` 与内容层必须有单元测试；新页面必须补 E2E 关键路径
- 提交前 `pnpm lint && pnpm test && pnpm build` 全绿

## 分支与提交

- 分支：`<type>/<slug>`（`feat/` 开发、`prd/` 文档），禁止 rebase/squash，只 merge
- 提交信息：`<type>: <描述>`，与仓库现有风格一致

## 相关文档

- 技术方案：[[proposals/2026-08-11-fan-site-tech-proposal.md]]
- PRD：[[../product/requirements/reviewed/2026-08-11-sumire-fan-site-prd.md]]
