# apps/bookstore

枝堇Sumire 粉丝站前端——Next.js（App Router）全静态（SSG）+ 后台 `/backdoor` 路由区（客户端会话/权限守卫）。

开发前加载 `docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与 `docs/engineering/backend-rules.md`（后台页面依赖的 API 契约见 `contract/backdoor-auth.openapi.yaml`）。

## 技术栈

- Next.js（App Router）+ React + TypeScript（strict），全部静态生成（SSG）
- Tailwind CSS v4，token 定义于 `app/globals.css` 的 `@theme`
- 内容：仓库内 YAML + Zod 校验（`lib/content/`）
- 测试：Vitest（单元）+ Playwright（E2E）

## 常用命令

```bash
pnpm dev          # 本地开发
pnpm build        # 生成缩略图 + 生产构建
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试
pnpm lint         # ESLint
```

## 目录

| 目录 | 职责 |
|------|------|
| `app/` | 路由与页面；`app/backdoor/` 为后台路由区 |
| `features/backdoor/` | 后台会话守卫、权限守卫、API 调用、后台组件 |
| `features/<模块>/` | 页面/工具业务组件 |
| `components/` | 设计系统组件 |
| `lib/` | 内容加载与工具 |
| `content/` | 站点数据 YAML |
| `public/assets/` | 素材原图与缩略图 |
| `tests/` | 单元测试 |

## 后台 /backdoor 约定

- 保持 SSG，会话/权限守卫在客户端；`features/backdoor/session.tsx` 的 `SessionProvider` 负责会话守卫与强制改密引导，`RequireRole` 负责权限守卫；
- 构建时守卫：`app/backdoor/layout.tsx` 读取 `api.ts` 导出的 `API_CONFIGURED`（`NEXT_PUBLIC_API_BASE_URL` 非空即已配置），未配置时直接渲染 `components/NotFoundPage` 站点风格 404（`SessionProvider` 不进入组件树）；`api.ts` 的 `request()` 亦在未配置时短路不 `fetch`，双保险杜绝发往主站自身的 `/api/*` 请求；
- API 调用统一走 `features/backdoor/api.ts`，`fetch(..., { credentials: "include" })`，base URL 取 `NEXT_PUBLIC_API_BASE_URL`；
- 视觉严格按 `docs/design/03-backdoor-design.md`：仅用 `@theme` token 色，后台不使用氛围动效，控件过渡 ≤200ms 且尊重 `prefers-reduced-motion`；
- 不出现注册/找回密码入口，不出现未上线功能占位。

提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
