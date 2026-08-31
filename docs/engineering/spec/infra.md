# 基础设施 Spec（infra/aspire）

本地联调统一用 .NET Aspire 编排：`infra/aspire/apphost.cs`（单文件 AppHost，SDK `Aspire.AppHost.Sdk@13.4.6`），启动 `cd infra/aspire && aspire start`。

## 编排资源（四个）

| 资源 | 类型 | 用途 |
|---|---|---|
| `redis` | 容器 | 会话存储、登录限速计数、live-history / live-status 缓存 |
| `mongodb` | 容器（mongo:7，`ContainerLifetime.Session`） | `sumire` 库：`users`、`stream_plans`、`live_event_reads` |
| `api` | `AddJavaScriptApp`（`../../servers/api`，`pnpm dev`） | 后端 API |
| `bookstore` | `AddNextJsApp`（pnpm） | 前端静态站（dev 模式） |

## 依赖与注入

- `api`：`WithReference(redis/mongodb)` 注入 `REDIS_URI` 与 `ConnectionStrings__mongodb`；注入 `SESSION_SECRET=dev-secret`、种子超管 `BACKDOOR_USERNAME=supersumire` 与 `BACKDOOR_PASSWORD_HASH`（salamander 的 bcrypt）。
- 上游覆盖：`LIVE_HISTORY_UPSTREAM_URL` / `LIVE_EVENTS_UPSTREAM_URL` / `LIVE_STATUS_UPSTREAM_URL` 可被编排进程环境变量覆盖（测试时指向 stub），否则回退内网 `http://vtuber.internal.fffdan.com`（房间 1727076670；live-status 回退完整 `state/current` 路径）。
- `bookstore`：`WithReference(api)`，`NEXT_PUBLIC_API_BASE_URL` 注入 api 的 http 端点。
- `api` 的 `CORS_ORIGINS` 反向引用 bookstore 端点（声明在 bookstore 之后）。

## 测试集成

集成测试端点经 `aspire describe <resource> --output json` 获取并注入环境变量（见 [testing.md](testing.md)）。

## 部署

- bookstore：`output: "export"` 静态导出（`out/`），部署 GitHub Pages，`basePath` 由 `NEXT_PUBLIC_BASE_PATH` 注入。
- api：`servers/api/Dockerfile` 容器化部署。
