---
description: 枝堇Sumire 后台系统 V1 实现方案——基于 PRD v1.3 与技术提案 v1.3 的契约式实施计划（单分支实施、实施步骤、验证与追踪）
type: Permanent
---

# 后台系统 V1 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-12-backdoor-auth-prd.md]]（v1.3，AC-1 ~ AC-27）
**关联技术提案**: [[../proposals/2026-08-12-backdoor-auth-proposal.md]]（v1.3）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `feat/monorepo`（需求总 PR：<https://github.com/Deliay/sumire/pull/3>）
**创建日期**: 2026-08-12
**作者**: ash

本方案将技术提案 v1.3 落实为可执行的实施计划，遵循 z-coding 契约式开发流程：更新 Contract → 编写实现（并行 subagent）→ 编排服务 → 覆盖 API 测试 → 覆盖 e2e 测试。按需求方指示，**不再切任何开发/子分支，全部工作直接在需求总分支 `feat/monorepo` 上进行**，按步骤小步提交。全程遵循 TDD，实现代码前先加载对应目录的 AGENTS.md 与 `docs/engineering/frontend-rules.md`。

## 1. 现状与差距

| 项 | 现状 | 目标（依据提案） |
|----|------|----------------|
| `pnpm-workspace.yaml` | 仅含 `apps/*`、`packages/*` | 增加 `servers/*`、`tests/*` |
| `contract/` | 不存在 | 新建 `contract/backdoor-auth.openapi.yaml`（提案 §3.3 完整契约） |
| `servers/api` | 不存在 | Express 5 + TS strict 纯 API 服务（提案 §6） |
| `apps/bookstore/app/backdoor` | 不存在 | `/backdoor` 路由区 5 个页面 + `features/backdoor/` 守卫与 API 调用 |
| 书店页脚 | `components/Footer.tsx` 无后台入口 | 右下角新增「管理 →」链接（`/backdoor`） |
| `infra/aspire/apphost.cs` | 仅编排 bookstore | 扩展为 bookstore + api + Redis + MongoDB（提案 §7.2 目标形态） |
| `tests/api`、`tests/e2e` | 不存在 | 独立集成测试工程（提案 §8.2、§8.3） |
| `docs/engineering/backend-rules.md` | 不存在（z-coding 后端开发要求加载） | 随后端实现一并产出 |
| 各新目录 AGENTS.md | 不存在 | 实现过程中按 z-coding 固定知识库要求创建/更新 |

## 2. 分支与提交

- **单分支实施**：不创建开发分支与子分支，契约、实现、编排、测试、文档全部直接在需求总分支 `feat/monorepo` 上提交并推送，需求总 PR #3 随提交持续更新；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`，与仓库现有风格一致；禁止 rebase/squash；
- 两个实现 subagent（步骤 1）在同一分支上按目录隔离并行推进：`servers/api` 与 `apps/bookstore` 文件不相交，分别提交，不互相等待；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：工程基座（feat/monorepo）

1. `pnpm-workspace.yaml` 增加 `servers/*`、`tests/*`；
2. 新建 `contract/backdoor-auth.openapi.yaml`：将提案 §3.3 的契约骨架补全为完整可校验的 OpenAPI 3.1 文档（6 个接口、Role/Ok/MeOk/User/Error schema、7 个复用 response），作为单一事实源；
3. 新建 `docs/engineering/backend-rules.md`：后端统一约定（Express 5 + TS strict、分层 `auth/rbac/session/db/routes`、错误响应统一 `{ error }` 中文文案、Vitest 单测要求、提交格式），格式对齐 `frontend-rules.md`。

**验证**：`pnpm install` 通过；契约文件可被 OpenAPI 校验工具解析。

### 步骤 1：并行实现（两个 subagent，同分支按目录隔离）

两个子项目实现互相独立（页面只依赖契约规定的 HTTP 接口，以 `NEXT_PUBLIC_API_BASE_URL` 指向 API），可并行推进。每个 subagent 的待办按 z-coding 模板：代码实现 → 提交 → 覆盖单元测试 → 运行并修复 → 提交 → 更新 AGENTS.md。遵循 TDD（先写失败测试再实现）。

#### 1a. `servers/api`（后端 subagent）

- 加载 `docs/engineering/backend-rules.md`（步骤 0 产出）；
- 按提案 §6 结构实现：`src/index.ts`（入口）、`app.ts`（仅挂载 `/api` 路由 + CORS）、`auth/`（登录/登出/改密/会话中间件）、`rbac/requireRole`、`session/`（ioredis，`session:<id>` JSON，TTL 7 天滑动）、`db/`（Mongoose `users` 模型：`username/passwordHash/role/mustChangePassword/createdAt`）、`routes/`（`/api/auth/*`、`/api/users`）；
- 关键行为以契约与提案 §3.2 为准：bcrypt 哈希、密码强度规则（≥12 位且含字母/数字/符号）、改密 same-as-old 400 / wrong-old 401、强制改密标记、创建用户角色降级（superadmin 任意 / admin 仅 member / member 403）、登录限速 5 次/分钟/IP（Redis）、Cookie `sumire_sid`（HttpOnly/Path=/SameSite=Lax/Max-Age=604800/无 Domain，生产 Secure）、logout 幂等、非 `/api` 路径一律 404、启动时种子超管（`BACKDOOR_USERNAME`/`BACKDOOR_PASSWORD_HASH`，幂等不覆盖）；
- 单元测试（Vitest）覆盖提案 §8.4 后端清单：强度校验各分支、`requireRole` 权限矩阵、角色降级规则、改密分支、限速计数、种子幂等、404 边界；
- 更新 `servers/api/AGENTS.md`。

**验证**：`pnpm -C servers/api test && pnpm -C servers/api lint`（或 tsc）全绿。

#### 1b. `apps/bookstore` `/backdoor` 路由区（前端 subagent）

- 加载 `docs/engineering/frontend-rules.md`、`frontend-design` 与 `vercel-react-best-practices` skill，视觉严格按设计文档 `docs/design/03-backdoor-design.md`；
- 路由（保持 SSG，全部守卫在客户端）：`app/backdoor/login/page.tsx`（登录页，静态无需守卫）、`app/backdoor/change-password/page.tsx`（强制改密独立页 + 日常改密布局内两形态）、`app/backdoor/layout.tsx` + `page.tsx`（仪表盘布局：TopBar + SideNav + 内容区）、`app/backdoor/users/page.tsx`（用户管理，仅超管，内嵌 CreateUserDialog 增加用户）；
- `features/backdoor/`：API client（`fetch(..., { credentials: "include" })`，base URL 取 `NEXT_PUBLIC_API_BASE_URL`）、会话守卫（me 401 → 登录页；`mustChangePassword` → 改密页，改密页除外防循环）、权限守卫（users 需 superadmin，不满足跳仪表盘）、导航按角色渲染；
- 组件按设计文档 §5 清单：`LoginCard`、`ChangePasswordCard`、`PasswordRulesHint`、`TextField`、`PrimaryButton`、`TopBar`、`SideNav`、`RoleBadge`、`UserTable`、`RoleSelect`、`SessionNote`、`GuardLoading`（静态藤蔓分隔线复用书店 `VineDivider`）；仅用 `@theme` token 色，后台不使用氛围动效，控件过渡 ≤200ms 且尊重 `prefers-reduced-motion`；不出现注册/找回密码入口，不出现未上线功能占位；
- `components/Footer.tsx` 右下角新增「管理 →」链接（`href="/backdoor"`，样式与页脚一致）；
- 单元测试（Vitest）覆盖提案 §8.4 前端清单：表单状态、守卫三分支、权限导航渲染、页脚链接；
- 更新 `apps/bookstore/AGENTS.md`（不存在则创建）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 2：Aspire 编排（SKILL: z-aspire-orchestrator）

- 按提案 §7.2 目标形态改写 `infra/aspire/apphost.cs`：增加 `Aspire.Hosting.Redis`、`Aspire.Hosting.MongoDB` package；`AddNodeApp("api", "../../servers/api", ...)` + `WithHttpEndpoint(env: "PORT")` + `WithReference/WaitFor(redis, mongodb)`；注入 `SESSION_SECRET`、`BACKDOOR_USERNAME`、`BACKDOOR_PASSWORD_HASH`（开发用 bcrypt 哈希）；bookstore 侧 `WithReference(api)` + `NEXT_PUBLIC_API_BASE_URL`；api 侧 `CORS_ORIGINS` 引用 bookstore endpoint（声明在 bookstore 之后）。

**验证**：`cd infra/aspire && aspire restore && aspire start`，`aspire describe` 四资源全部 Running/Healthy；未登录访问 bookstore 端点 `/backdoor` 跳转登录页；api 非 `/api` 路径 404。

### 步骤 3：API 集成测试（SKILL: z-test）

- 新建 `tests/api/`（TS + Vitest + Node 内置 fetch，手工 Cookie jar，不用 supertest）；目录结构、基态、数据隔离策略（随机后缀用户名、不动 `supersumire` 种子密码、限速用例最后执行）严格按提案 §8.2；
- 用例清单 = 提案 §8.2 全部 28 条（`login-200` ~ `cors-credentials`），只依据契约与 PRD 编写，禁止对照 `servers/` 实现；
- 运行方式：Aspire 拉起环境，`aspire describe` 取端点注入 `API_BASE_URL`/`BOOKSTORE_ORIGIN`；失败用例由 subagent 按契约与 `docs/engineering` 修复（实现侧问题改实现、用例侧问题改用例），全部用例通过后提交。

### 步骤 4：e2e 集成测试（SKILL: z-test）

- 新建 `tests/e2e/`（Playwright，`playwright.config.ts` 不用 `webServer`，`BOOKSTORE_BASE_URL` 环境变量注入）；目录结构按提案 §8.3；
- 用例清单 = 提案 §8.3 全部 16 条（`auth-redirect` ~ `bookstore-footer-link`），覆盖 AC-1~AC-27 中页面层条目；编写阶段每条用例前后截图验证，调试完成后移除截图逻辑（`visual-sanity` 截图保留为 artifact）；
- `globalSetup` 通过 API 准备三种角色的已完成改密账号（用户名带运行标识后缀，与 tests/api 基态隔离）；
- 运行与修复流程同步骤 3，全部用例通过后提交。

### 步骤 5：收尾与验收

1. 更新根 `AGENTS.md`：Monorepo 结构补充 `servers/api`、`contract/`、`tests/`、`infra/aspire` 编排说明；
2. 核对提案 §10 验收标准全量通过；PRD AC-1~AC-27 每条均有集成用例覆盖（追踪表见提案 §8.1）；
3. 推送 `feat/monorepo`，确认需求总 PR #3 已包含全部实现与测试。

## 4. 依赖与风险

- **依赖**：本地需可用的 Aspire 13 SDK 与容器运行时（Redis/MongoDB 容器）；`BACKDOOR_PASSWORD_HASH` 需预生成 bcrypt 哈希用于开发编排；
- **风险**：Aspire `AddNodeApp` 对 Express/TS 服务的接入细节（构建产物 vs tsx 运行）需在步骤 2 实测确认，若 `AddNodeApp` 不适用则回退 `AddExecutable`/容器化并在提案中记录偏差；集成测试依赖 Aspire 编排稳定性，限速用例需隔离执行避免误伤其他用例。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-12-backdoor-auth-prd.md]]
- 技术提案：[[../proposals/2026-08-12-backdoor-auth-proposal.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 前端规范：[[../frontend-rules.md]]
