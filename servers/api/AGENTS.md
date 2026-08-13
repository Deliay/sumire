# servers/api

枝堇Sumire 后台系统 V1 后端——Express 5 + TypeScript（strict）纯 API 服务，不托管任何页面。

开发前加载 `docs/engineering/backend-rules.md` 与 API 契约 `contract/backdoor-auth.openapi.yaml`、`contract/stream-plans.openapi.yaml`（均为单一事实源）。

## 技术栈

- Node.js + Express 5 + TypeScript（strict），纯 API（仅 `/api/*`，其余 404）
- Session-Cookie + Redis（ioredis），会话 TTL 7 天滑动
- 权限：`requireRole` 角色中间件（superadmin > admin > member）
- MongoDB（Mongoose）持久化 `users`
- bcryptjs 密码哈希
- Vitest 单元测试

## 常用命令

在 `servers/api/` 下执行：

```bash
pnpm dev        # tsx watch 本地开发
pnpm build      # tsc 构建
pnpm test       # Vitest 单元测试
pnpm lint       # tsc --noEmit 类型检查
```

## 目录

| 目录 | 职责 |
|------|------|
| `src/index.ts` | 入口：连接存储、种子、启动 |
| `src/app.ts` | Express 装配（仅 /api + CORS） |
| `src/auth/` | 登录/登出/改密/会话/限速 |
| `src/rbac/` | 角色与权限中间件 |
| `src/session/` | Redis 会话与 Cookie |
| `src/db/` | MongoDB 连接与 users、stream_plans 模型 |
| `src/routes/` | /api/auth/*、/api/users、/api/stream-plans |
| `tests/` | 单元测试 |

## 关键约定

- 错误响应统一 `{ error: string }`，中文文案；
- 密码强度：≥16 位且含字母、数字、符号（服务端校验为准）；
- 初始超管 `supersumire` 由 `BACKDOOR_USERNAME`/`BACKDOOR_PASSWORD_HASH` 种子（幂等）；
- 改密后 `mustChangePassword=false`；新用户创建后 `true`；
- 登录限速 5 次/分钟/IP（Redis）；
- `/api/stream-plans`：GET 公开读（无需登录，`from`/`to` 显式日期校验后走 `$gte`/`$lte`，拒绝对象注入）；POST/PUT/DELETE 走 `requireRole("admin")`（superadmin/admin 可写，member 403）。字段：`date` 为 `YYYY-MM-DD` 真实日期、`startTime` 为 `HH:mm` 真实时间（`isValidTime`）、`title` trim 后 1–50 字符；判重键 `(date, startTime, title)`（PUT 编辑排除自身 409）；PUT/DELETE `:id` 先校验 ObjectId 形态否则 400、不存在 404，PUT 写 `updatedAt`；`stream_plans` 集合由 mongoose 自动创建。

提交前 `pnpm lint && pnpm test` 全绿。相关文档：[[../../docs/engineering/backend-rules.md]]
