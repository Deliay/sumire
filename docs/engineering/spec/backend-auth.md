# 后端鉴权域 Spec（servers/api — auth / session / rbac / users）

Express 5 + TS strict 纯 API 服务（包名 `@sumire/api`），仅挂载 `/api/*`，其余一律 404。启动入口 `src/index.ts`：连 MongoDB → 幂等种子超管 → 建 ioredis 单连接 → `createApp(deps)`。依赖注入风格：`createApp`（`src/app.ts`）接受 `sessionStore` / `rateLimiter` / `liveHistoryCache` / `liveEventsUpstream` / `toRomajiFn`，均可注入 stub 便于测试。

## 配置（src/config.ts）

环境变量集中解析：`PORT`(3001)、`redisUrl`（兼容 Aspire 注入名）、`mongodbUrl`、`cookieSecure`、`corsOrigins`（白名单精确匹配，空则放行全部）、超管种子账号/密码哈希、上游 URL（有内置缺省）。常量：`COOKIE_NAME="sumire_sid"`、会话 TTL 7 天、登录限流 5 次/分/IP。

## 中间件链（src/app.ts）

CORS（精确 origin 白名单 + credentials，禁用 `*`）→ `express.json()` → 会话中间件 → `/api` 路由 → 404/500 兜底（统一错误体 `{ error: string }`，中文文案）。

## 会话机制

- Cookie `sumire_sid`：HttpOnly / SameSite=Lax / Path=/ / Max-Age=7 天 / 无 Domain，生产加 Secure。
- 存储：Redis `session:{sid}`（sid = `crypto.randomUUID()`），JSON `{userId, username, role, createdAt, lastSeenAt}`；TTL 7 天且每次有效请求**滑动刷新**（touch 更新 `lastSeenAt`）。
- 会话中间件（`auth/session.ts`）只解析挂载 `req.user`，不强制登录。
- 登出幂等：删 Redis 会话 + Cookie 立即过期，无会话也 200。

## RBAC

- 三级角色 `superadmin(2) > admin(1) > member(0)`（`rbac/roles.ts`）；`requireRole(min)` 未登录 401 / 不足 403。
- 创建降级规则 `canCreate`：superadmin 可建任意角色，admin 仅可建 member，member 无创建权。
- `GET /api/users` 走路由内手写判断（仅 superadmin），其余受限端点走 `requireRole`。

## 用户模型（db/users.ts）

Mongo `users` 集合：username 唯一、passwordHash（bcrypt cost 10）、role、`mustChangePassword`（默认 true）、createdAt。`seedSuperadmin` 幂等。

## 密码与限流

- 密码强度（`auth/password.ts`）：≥12 位 + 字母 + 数字 + 符号。
- 登录限流（`auth/rateLimit.ts`）：Redis 键 `login:{ip}`，60s 窗口内失败计数 ≥5 → 429；只在登录失败时计数，成功不清零。

## 端点

| 方法+路径 | 鉴权 | 要点 |
|---|---|---|
| POST `/api/auth/login` | 公开+限流 | bcrypt 校验，成功写 Cookie，返回 `{ok, username, role, mustChangePassword}`；401 不区分账号/密码；429 限流 |
| POST `/api/auth/logout` | 公开（幂等） | 删会话 + Cookie 过期 |
| GET `/api/auth/me` | 登录 | 返回 username/role/mustChangePassword，**mustChangePassword 以 DB 为准** |
| POST `/api/auth/change-password` | 登录 | 旧密码错 401、新=旧 400、强度不足 400；成功后 `mustChangePassword=false`，会话不失效 |
| GET `/api/users` | 仅 superadmin | 列表不含 hash |
| POST `/api/users` | 登录+`canCreate` | 201；409 用户名重复；新用户 `mustChangePassword=true` |

契约：`contract/backdoor-auth.openapi.yaml`。
