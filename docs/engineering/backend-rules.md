---
description: sumire 后端开发统一规范——技术栈、目录约定、鉴权与测试规范
type: Permanent
---

# 后端开发规范

本文件是 sumire 后端开发的统一约定，开发前必须加载。后端项目位于 monorepo 的 `servers/api/`，下文目录均为该目录内的相对路径。设计契约见 [[../design/03-backdoor-design.md]]，API 契约见 `contract/backdoor-auth.openapi.yaml`（单一事实源）。

## 技术栈

- Node.js + Express 5 + TypeScript（strict），纯 API 服务（不托管任何页面）
- 鉴权：Session-Cookie + Redis 会话存储（ioredis），会话即 Redis key，TTL 7 天滑动
- 权限：角色层级中间件 `requireRole`（superadmin > admin > member），服务端强制
- 业务数据：MongoDB（Mongoose），`users` 集合持久化
- 密码：bcrypt 哈希存储，禁止明文
- 测试：Vitest（单元）；集成测试见 `tests/api`、`tests/e2e`

## 常用命令

在 `servers/api/` 目录下执行：

```bash
pnpm dev        # 本地开发
pnpm build      # 构建
pnpm test       # 单元测试
pnpm lint       # 类型检查（tsc --noEmit）
```

## 目录约定

| 目录 | 职责 |
|------|------|
| `src/index.ts` | 服务入口：连接存储、种子、启动 |
| `src/app.ts` | Express 装配：仅挂载 `/api` 路由 + CORS |
| `src/auth/` | 登录/登出/改密/会话中间件 |
| `src/rbac/` | `requireRole` 权限中间件 |
| `src/session/` | Redis 会话读写与 Cookie 处理 |
| `src/db/` | MongoDB 连接与 `users` 模型 |
| `src/routes/` | `/api/auth/*`、`/api/users` 路由处理 |
| `tests/` | 单元测试（Vitest） |

## 接口与错误约定

- 服务仅暴露 `/api/*` 前缀路由，其余路径一律 404；
- 所有错误响应统一 `{ error: string }`，提示语为中文；
- 登录失败（401）不区分账号错误与密码错误，统一「账号或密码错误」；
- `logout` 幂等：无会话也返回 200 并清除 Cookie；
- 权限不足一律 403（已登录但角色不够），未登录一律 401。

## 安全约定

- 密码强度规则（改密与创建用户统一，服务端为准）：长度 ≥ 16 且同时含字母、数字、符号；校验失败 400 提示缺失项；
- 新密码与原密码相同返回 400；原密码错误返回 401；改密成功将 `mustChangePassword` 置 false；
- Cookie `sumire_sid`：`HttpOnly`、`Path=/`、`SameSite=Lax`、`Max-Age=604800`、不设置 `Domain`；生产 `Secure`；
- 登录限速：按 IP 5 次/分钟（Redis 计数，窗口 60s），超限 429；
- CORS 对 `CORS_ORIGINS` 白名单返回精确 `Access-Control-Allow-Origin`（禁用 `*`）+ `Access-Control-Allow-Credentials: true`。

## 测试规范

- 遵循 TDD：先写失败测试再实现（参考 `tdd` skill）；
- 单元测试覆盖：密码强度校验各分支、`requireRole` 权限矩阵、创建用户角色降级、改密分支、限速计数、种子幂等、非 `/api` 404 边界；
- 提交前 `pnpm lint && pnpm test` 全绿。

## 分支与提交

- 分支：`<type>/<slug>`，禁止 rebase/squash，只 merge；
- 提交信息：`<type>: <描述>`，与仓库现有风格一致。

## 相关文档

- API 契约：`contract/backdoor-auth.openapi.yaml`
- 技术方案：[[proposals/2026-08-12-backdoor-auth-proposal.md]]
- PRD：[[../product/requirements/draft/2026-08-12-backdoor-auth-prd.md]]
