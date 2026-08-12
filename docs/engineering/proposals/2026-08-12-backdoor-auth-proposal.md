---
description: 枝堇Sumire 后台系统 V1 技术方案——书店内 /backdoor 路由 + Express 纯 API 鉴权服务，含契约与 API/e2e 测试细节
type: Permanent
---

# 枝堇Sumire 后台系统 V1 - 技术提案

**功能名称**: 后台系统 V1——登入登出
**关联 PRD**: [[../product/requirements/draft/2026-08-12-backdoor-auth-prd.md]]
**关联设计**: [[../design/03-backdoor-design.md]]
**技术提案版本**: v1.2
**创建日期**: 2026-08-12
**作者**: ash
**feat-branch**: `feat/backdoor-auth`

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-08-12 | 初版：Express + Session/Redis + MongoDB + Aspire 编排 |
| v1.1 | 2026-08-12 | 重写：补充 OpenAPI 契约；测试策略展开为 API/e2e 集成测试方案 |
| v1.2 | 2026-08-12 | 返工修订：**取消独立后台前端 `apps/backdoor-web`，后台页面并入 `apps/bookstore`（`/backdoor` 路由前缀）；`servers/api` 只提供 API 服务，不再静态托管前端**。会话守卫改为页面客户端校验（`/api/auth/me`），跨域模型改为同 site 跨源 + CORS 凭证 |

## 1. 概述

### 1.1 背景

书店站点为纯静态（Next.js SSG，GitHub Pages 托管），不具备服务端能力。随着后续管理功能（素材、档案、弹幕后台等）推进，需要一个受保护的独立后台。V1 建立「鉴权 + 后台界面框架」骨架：**后台页面作为书店应用的 `/backdoor` 路由区实现**（与公开内容路由隔离、保持 SSG），**鉴权能力由独立后端 `servers/api` 以纯 API 形式提供**。

### 1.2 目标

- 提供登入/登出能力，不开放注册，超管单账号（`supersumire`）；
- 会话 7 天有效，允许多端同时在线、各自独立登出；
- 账号等业务数据持久化到 MongoDB，Redis 仅承担会话与限速等临时状态；
- 后台页面归属书店（`/backdoor` 前缀），后端只提供 API、不托管任何页面；
- 本地开发统一由 Aspire 编排（bookstore + api + Redis + MongoDB）。

### 1.3 范围

- 做：`apps/bookstore` 新增 `/backdoor` 路由区（登录页 + 仪表盘布局）、`servers/api`（Express 纯 API：鉴权）、书店页脚「管理 →」入口、Redis 会话存储、MongoDB 持久化、API 契约（OpenAPI）、Aspire 编排、API 集成测试与 e2e 测试工程；
- 不做：注册、多管理员账号、找回/修改密码界面、任何具体管理功能、占位导航、后端对前端页面的任何形式的托管。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph TD
    U[浏览器] -->|sumire.live<br>/backdoor/login /backdoor| B[bookstore<br>Next.js SSG]
    U -->|sumire.live 书店公开页| B
    B -->|同源页面内 fetch<br>credentials: include| A[api.sumire.live<br>Express 纯 API]
    A -->|Session 读写| C[(Redis)]
    A -->|业务数据持久化| M[(MongoDB)]
```

后台页面（HTML/JS）全部由书店应用以 `/backdoor` 路由提供；页面内通过 `fetch(..., { credentials: "include" })` 调用 `api.sumire.live` 的鉴权 API。`servers/api` 只暴露 `/api/*`，不返回任何页面。

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 后台页面 | Next.js（书店应用内 `/backdoor` 路由，SSG + 客户端会话守卫） | `apps/bookstore/app/backdoor/*`，复用书店设计 token 与组件体系 |
| 后端框架 | Node.js + Express 5 + TypeScript（strict） | `servers/api`，纯 API 服务 |
| 鉴权方案 | **Session-Cookie + Redis 会话存储** | 服务端会话，7 天 TTL，多端独立 |
| 会话存储 | ioredis + Redis | 会话即 Redis key，TTL 天然过期 |
| 业务数据 | MongoDB（Mongoose） | 账号、后台业务数据持久化 |
| 密码存储 | bcrypt | 哈希存储，不落明文 |
| API 契约 | OpenAPI 3.1（YAML） | `contract/backdoor-auth.openapi.yaml`，见 §3.3 |
| 防爆破 | express-rate-limit（Redis 存储） | 登录接口限速 |
| 单元测试 | Vitest | `servers/api` 与 `apps/bookstore` 各自内部 |
| 集成测试 | Vitest（API，`tests/api`）+ Playwright（e2e，`tests/e2e`） | 详见 §8 |
| 编排 | Aspire（C# AppHost，`infra/aspire`） | bookstore + api + Redis + MongoDB 容器，见 §7 |
| 包管理 | pnpm workspace | `servers/*`、`apps/*`、`tests/*` 纳入 workspace |

### 2.3 鉴权方案选型（决策）

| 维度 | Session-Cookie + Redis（选择） | JWT |
|------|------|------|
| 登出立即失效 | ✅ 删除 Redis 会话即失效 | ❌ 服务端无法撤销，需黑名单 |
| 多端独立会话 | ✅ 每端一个 Session | ⚠️ 需管理 refresh/黑名单 |
| 会话过期控制 | ✅ Redis TTL = 7 天 | ✅ 依赖 exp |
| 实现复杂度 | 低（express-session） | 中（签发/校验/续期/撤销） |
| 适合场景 | 单一超管、服务端可控 | 开放注册、无状态横向扩展 |

**结论**：本项目不开放注册、仅超管单账号、要求登出立即可失效，且已引入 Redis —— Session-Cookie 是更简单可靠的方案。会话 id 存放于 httpOnly Cookie，服务端数据仅存 Redis。

### 2.4 模块划分

```mermaid
graph LR
    B[apps/bookstore] --> B1[app/backdoor/login 登录页]
    B --> B2[app/backdoor 仪表盘布局 + 欢迎页]
    B --> B3[features/backdoor 会话守卫/鉴权 API 调用]
    A[servers/api] --> C[app: Express 装配（仅 /api 路由）]
    A --> D[auth: 登录/登出/会话校验]
    A --> E[session: Redis 会话中间件]
    A --> F[db: MongoDB 数据层]
    A --> G[routes: /api/auth/*]
```

**会话守卫（关键决策）**：书店保持 SSG，无服务端渲染能力，因此 `/backdoor` 页面的守卫在**客户端**完成——页面加载后先渲染加载态，调用 `GET /api/auth/me`；200 渲染内容，401 跳转 `/backdoor/login`。公开页与后台页静态产物均可公开缓存，机密性完全由 API 层的 401 保证（V1 仪表盘无敏感数据，后续管理页面的数据一律经 API 获取，同样受 401 保护）。

## 3. API 设计

### 3.1 鉴权接口

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/auth/login` | 登录 | `{ username, password }` | 200 `{ ok: true, username }`，Set-Cookie 会话；401 `{ error: "账号或密码错误" }`；429 `{ error: "尝试过于频繁" }` |
| POST | `/api/auth/logout` | 登出（删除当前会话） | — | 200 `{ ok: true }`，清除 Cookie；未登录调用亦返回 200（幂等） |
| GET | `/api/auth/me` | 当前会话校验 | — | 200 `{ ok: true, username }`；401 `{ error: "未登录" }` |

约定：

- 所有错误响应均为 `{ error: string }`，提示语为中文；
- 登录失败（401）不区分账号错误与密码错误；
- `logout` 设计为幂等：无会话/会话已失效时同样返回 200 并清除 Cookie，前端无需区分；
- `servers/api` 仅暴露 `/api/*` 前缀路由，其余路径一律 404（不含任何页面或静态资源托管）。

### 3.2 会话与安全模型

- **会话存储**：Redis key `session:<id>`，value 为 JSON `{ userId, username, createdAt, lastSeenAt }`，TTL = 7 天；每次通过会话校验时刷新 TTL（滑动过期）；
- **会话 id**：`crypto.randomUUID()` 生成，不可猜测；Redis 中不存在自增或可枚举的会话键名（key 含随机 id）；
- **Cookie**：`sumire_sid`，`HttpOnly`、`Path=/`、`SameSite=Lax`；生产 `Secure`；`Max-Age` 与 TTL 一致（7 天）。**不设置 `Domain`**（host-only，落在 `api.sumire.live`）；
- **跨域模型**：页面在 `sumire.live`、API 在 `api.sumire.live`，属**同 site（eTLD+1 相同）跨源**。`SameSite=Lax` 按 site 判定，书店页面发起的 `fetch(..., { credentials: "include" })` 可正常携带 Cookie；CORS 侧 api 对 `CORS_ORIGINS` 白名单来源返回 `Access-Control-Allow-Origin`（精确来源，禁用 `*`）+ `Access-Control-Allow-Credentials: true`；
- **密码**：`supersumire` 的 bcrypt 哈希持久化于 MongoDB `users` 集合，不写入代码仓库；初始密码 `salamander` 的哈希由部署方以 `BACKDOOR_PASSWORD_HASH` 注入，文档提示上线前修改；
- **防爆破**：登录接口按 IP 限速 5 次/分钟（Redis 计数，窗口 60s），超限返回 429；限速计数与会话无关；
- **会话校验**：`/api/auth/*` 中需要会话的接口由中间件校验 Cookie → Redis，失效返回 401；页面侧守卫见 §2.4（客户端基于 `/api/auth/me` 结果跳转）。

### 3.3 API 契约（OpenAPI）

契约式开发：鉴权 API 的 OpenAPI 3.1 规范作为单一事实源，放置在 `contract/backdoor-auth.openapi.yaml`。实现与 `tests/api` 集成测试都以契约为准——测试用例只依据契约与 PRD 编写，禁止对照 `servers/` 实现编写（避免射箭画靶）。契约骨架：

```yaml
openapi: 3.1.0
info:
  title: sumire backdoor auth
  version: 1.0.0
paths:
  /api/auth/login:
    post:
      summary: 登录
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username: { type: string }
                password: { type: string }
      responses:
        "200":
          description: 登录成功，Set-Cookie 写入会话
          headers:
            Set-Cookie:
              schema: { type: string }
              description: sumire_sid=<id>; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800（生产含 Secure）
          content:
            application/json:
              schema: { $ref: "#/components/schemas/AuthOk" }
        "401": { $ref: "#/components/responses/InvalidCredentials" }
        "429": { $ref: "#/components/responses/RateLimited" }
  /api/auth/logout:
    post:
      summary: 登出（幂等，删除当前会话）
      responses:
        "200":
          description: 会话已删除，Set-Cookie 立即过期
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Ok" }
  /api/auth/me:
    get:
      summary: 当前会话校验
      responses:
        "200":
          description: 已登录
          content:
            application/json:
              schema: { $ref: "#/components/schemas/AuthOk" }
        "401": { $ref: "#/components/responses/Unauthorized" }
components:
  schemas:
    Ok:     { type: object, properties: { ok: { type: boolean, const: true } } }
    AuthOk: { type: object, properties: { ok: { type: boolean, const: true }, username: { type: string } } }
    Error:  { type: object, properties: { error: { type: string } } }
  responses:
    InvalidCredentials:
      description: 账号或密码错误
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    Unauthorized:
      description: 未登录或会话已失效
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    RateLimited:
      description: 尝试过于频繁
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
```

## 4. 路由规划

后台页面与书店同站（`sumire.live` 的 `/backdoor` 前缀），鉴权 API 挂在 `api.sumire.live`；`servers/api` 只提供 API。

| 路由 | 提供方 | 说明 |
|------|--------|------|
| `https://sumire.live/backdoor/login` | bookstore | 登录页（静态页面，无需会话） |
| `https://sumire.live/backdoor` | bookstore | 后台首页（静态页面 + 客户端会话守卫，未登录跳转登录页） |
| `https://sumire.live/backdoor/*` | bookstore | 后续管理功能页面（同一守卫模式） |
| `https://api.sumire.live/api/auth/*` | api | 鉴权 API（仅此前缀，其余 404） |
| 书店 `/` | bookstore | 页脚右下角「管理 →」链接跳转同站 `/backdoor` |

页面与 API 为同 site 跨源：会话 Cookie host-only 落在 `api.sumire.live`，书店页面以 `credentials: "include"` 调用 API 时携带（`SameSite=Lax` 同 site 放行）；api 通过 `CORS_ORIGINS`（书店域名）白名单 + `Allow-Credentials` 放行书店来源的请求（见 §3.2、§7.2）。书店与后台页面间无跨应用跳转，仅为站内路由切换。

## 5. 数据模型

- **MongoDB（业务数据持久化）**：
  - `users`：`{ username, passwordHash, role, createdAt }`，V1 种子超管记录（`supersumire`，`role: "superadmin"`），密码 bcrypt 哈希；
  - 后续管理功能（素材、档案等）的集合在此扩展。
- **Redis（临时状态）**：
  - 会话：`session:<id>` → JSON `{ userId, username, createdAt, lastSeenAt }`，TTL 7 天，滑动过期；
  - 登录限速：`login:<ip>` 计数，窗口 60 秒。
- 账号凭据初始化：启动时若 `users` 集合无超管记录，以环境变量 `BACKDOOR_USERNAME` / `BACKDOOR_PASSWORD_HASH`（bcrypt）种子插入；已存在则不覆盖（密码轮换通过后续管理功能或手工更新完成）。

## 6. 项目结构

```
sumire/
├── contract/
│   └── backdoor-auth.openapi.yaml  # 鉴权 API 契约（§3.3）
├── servers/
│   └── api/                        # Express 纯 API 后端（鉴权，无页面托管）
│       ├── src/
│       │   ├── index.ts            # 服务入口
│       │   ├── app.ts              # Express 装配（仅挂载 /api 路由 + CORS）
│       │   ├── auth/               # 登录/登出/会话中间件
│       │   ├── session/            # Redis 会话
│       │   ├── db/                 # MongoDB 连接与模型
│       │   └── routes/             # /api/auth/*
│       ├── tests/                  # 单元测试（Vitest）
│       └── package.json
├── apps/
│   └── bookstore/                  # 书店 + 后台页面（/backdoor 路由区）
│       ├── app/
│       │   └── backdoor/
│       │       ├── login/          # 登录页（静态）
│       │       └── page.tsx        # 仪表盘（布局 + 客户端守卫）
│       ├── features/backdoor/      # 会话守卫、鉴权 API 调用（credentials: include）
│       └── components/             # 复用书店组件体系 + 后台布局组件（顶栏/侧栏）
├── tests/
│   ├── api/                        # API 集成测试（Vitest，见 §8.2）
│   └── e2e/                        # e2e 集成测试（Playwright，见 §8.3）
├── infra/aspire/                   # AppHost（编排 bookstore + api + Redis + MongoDB）
└── docs/
```

`/backdoor` 路由区与书店公开页共享构建与部署，但通过独立的路由分组与布局与公开内容隔离；公开页导航不出现后台入口（仅页脚「管理 →」链接）。

## 7. 编排方案（Aspire）

本地开发由 Aspire 统一编排，AppHost 位于 `infra/aspire/apphost.cs`（C# 单文件，Aspire 13 SDK）。V1 编排 bookstore、api、Redis、MongoDB 四个资源，实现一条命令启动全部依赖。现有 `apphost.cs` 仅含 bookstore，本方案按 §7.2 扩展。

### 7.1 资源清单

| 资源名 | 类型 | 说明 |
|--------|------|------|
| `bookstore` | Next.js App | 书店（含 `/backdoor` 页面），`AddNextJsApp` + `.WithPnpm()` |
| `api` | Node.js App | 纯 API 后端，`AddNodeApp("api", "../../servers/api", ...)` |
| `redis` | Redis 容器 | 会话与限速存储 |
| `mongodb` | MongoDB 容器 | 业务数据持久化 |

### 7.2 依赖与注入

- `api` 通过 `.WithReference(redis)` / `.WithReference(mongodb)` 注入连接配置（`ConnectionStrings__redis` / `ConnectionStrings__mongodb` 由 api 侧映射为 `REDIS_URL` / `MONGODB_URL`），`WaitFor(redis)` / `WaitFor(mongodb)` 确保存储就绪后再启动；
- `api` 使用 `.WithHttpEndpoint(env: "PORT")` 暴露 http 端点；
- **跨域白名单**：页面（bookstore）与 API（api）为同 site 跨源部署，`api` 必须 `.WithReference(bookstore)`，将 bookstore 的 http endpoint 以 `CORS_ORIGINS` 注入自身环境变量，作为 CORS 允许来源（需同时放行凭证，见 §3.2）；本地开发时即书店 dev server 地址，生产时该变量由部署方替换为 `https://sumire.live`；
- **bookstore 感知 api 地址**：bookstore 的 `/backdoor` 页面需要知道 API base URL，通过 `.WithReference(api)` 将 api 端点以 `NEXT_PUBLIC_API_BASE_URL` 注入 bookstore 环境变量；生产为 `https://api.sumire.live`；
- `api` 所需环境变量（`SESSION_SECRET`、`BACKDOOR_PASSWORD_HASH` 等）由 `.WithEnvironment()` 注入。

```csharp
// infra/aspire/apphost.cs（目标形态示意）
#:sdk Aspire.AppHost.Sdk@13.4.6
#:package Aspire.Hosting.JavaScript@*
#:package Aspire.Hosting.Redis@*
#:package Aspire.Hosting.MongoDB@*

#pragma warning disable ASPIREJAVASCRIPT001

var builder = DistributedApplication.CreateBuilder(args);

var redis = builder.AddRedis("redis");
var mongodb = builder.AddMongoDB("mongodb");

var api = builder.AddNodeApp("api", "../../servers/api", "server.js")
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .WithReference(redis).WaitFor(redis)
    .WithReference(mongodb).WaitFor(mongodb)
    .WithEnvironment("SESSION_SECRET", "dev-secret")
    .WithEnvironment("BACKDOOR_USERNAME", "supersumire")
    .WithEnvironment("BACKDOOR_PASSWORD_HASH", "<dev bcrypt hash>");

var bookstore = builder
    .AddNextJsApp("bookstore", "../../apps/bookstore", runScriptName: "dev")
    .WithPnpm()
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .WithReference(api)
    .WithEnvironment("NEXT_PUBLIC_API_BASE_URL", api.GetEndpoint("http"));

// api 的 CORS 白名单引用 bookstore 端点（声明在 bookstore 之后）
api.WithEnvironment("CORS_ORIGINS", bookstore.GetEndpoint("http"));

builder.Build().Run();
```

### 7.3 本地启动

```bash
cd infra/aspire
aspire start
```

启动后 `aspire describe` 应展示四个资源全部 `Running/Healthy`；访问 bookstore 端点的 `/backdoor` 即后台，api 端点仅提供 `/api/*`。

### 7.4 验证要点

- `aspire restore` 恢复依赖、`aspire start` 启动、`aspire describe` 确认资源状态；
- bookstore 与 api、redis、mongodb 均健康；未登录访问 `/backdoor` 跳转登录页；
- 跨域校验：api 的 `CORS_ORIGINS` 为 bookstore 端点，书店来源的带凭证请求被允许，其他来源被拒绝；api 直接访问非 `/api` 路径返回 404。

## 8. 测试策略

测试分三层：单元测试随实现走（Vitest，各包内部）；**API 集成测试**与 **e2e 集成测试**为独立工程（`tests/api`、`tests/e2e`），只依据契约与 PRD 编写用例，禁止对照实现编写。集成测试运行依赖 Aspire 拉起完整环境，目标 endpoint 通过 `aspire describe` 获取并以环境变量注入测试工程。

### 8.1 测试范围与验收追踪

测试范围 = PRD §3.2 验收标准（AC-1 ~ AC-14）+ 契约中的全部接口行为。每条 AC 至少被一条集成用例覆盖：

| AC | 描述摘要 | 覆盖位置 |
|----|---------|---------|
| AC-1 | 未登录访问 `/backdoor` 跳转登录页 | e2e `auth-redirect` |
| AC-2 | 正确凭据登录进入后台首页 | e2e `login-success`、api `login-200` |
| AC-3 | 错误凭据提示且不区分原因 | e2e `login-failure`、api `login-401` |
| AC-4 | 无注册入口 | api `no-register-route`（契约外路径 404） |
| AC-5 | 7 天内刷新保持登录 | api `session-persist`（Cookie + TTL 断言）、e2e `login-success` 含 reload |
| AC-6 | 后台可点击登出 | e2e `logout-entry` |
| AC-7 | 登出后会话立即失效 | e2e `logout-invalidates`、api `logout-200` |
| AC-8 | 多端会话独立 | api `multi-session` |
| AC-9 | 布局为顶栏 + 侧栏 + 内容区 | e2e `dashboard-layout` |
| AC-10 | 仪表盘欢迎语、无占位 | e2e `dashboard-content` |
| AC-11 | 视觉与书店一致 | e2e `visual-sanity`（截图人工核对 + token 断言） |
| AC-12~14 | 书店页脚「管理 →」链接 | e2e `bookstore-footer-link` |
| — | 登录限速 429 | api `login-rate-limit` |
| — | Cookie 安全属性 | api `cookie-attributes` |
| — | api 不托管页面（纯 API） | api `api-only-surface` |
| — | CORS 凭证与白名单 | api `cors-credentials` |

### 8.2 API 集成测试（`tests/api`）

- **技术选型**：TypeScript + Vitest + `fetch`（Node 22 内置），手工维护 Cookie jar（从 `Set-Cookie` 解析 `sumire_sid`，随后续请求回带）。不引入 supertest——测试目标是**运行中的服务**而非 Express app 实例，与契约的黑盒定位一致；
- **目录结构**：

```
tests/api/
├── src/
│   └── api/
│       ├── client.ts          # fetch 封装：baseURL、Cookie jar、JSON/Origin 助手
│       ├── login.test.ts      # 登录用例
│       ├── logout.test.ts     # 登出用例
│       ├── session.test.ts    # 会话/me/限速用例
│       └── surface.test.ts    # 服务边界：纯 API 表面、CORS
├── tests/api/AGENTS.md        # 工程约定（创建时写入）
├── package.json
└── vitest.config.ts
```

- **用例清单**（依据契约 §3.3 与 PRD，黑盒）：

| 用例 | 步骤 | 断言 |
|------|------|------|
| `login-200` | POST `/api/auth/login` 正确凭据 | 200；`{ ok: true, username: "supersumire" }`；响应含 `Set-Cookie: sumire_sid=...` |
| `cookie-attributes` | 同上，解析 Set-Cookie | 含 `HttpOnly`、`Path=/`、`SameSite=Lax`、`Max-Age=604800`；不含 `Domain`（host-only）；生产模式含 `Secure` |
| `login-401` | 错误密码 / 不存在用户各一次 | 均 401；`{ error }` 文案相同，均为"账号或密码错误"；不下发 Cookie |
| `login-400` | 缺 `username` 或 `password` 字段 | 4xx + `{ error }`（契约允许 400 或 401，实现后回填精确值） |
| `no-register-route` | POST `/api/auth/register`（契约外） | 404 |
| `me-200` | 登录后带 Cookie GET `/api/auth/me` | 200 `{ ok: true, username }` |
| `me-401` | 无 Cookie / 伪造 sid 访问 `/api/auth/me` | 401 `{ error }` |
| `session-persist` | 登录后间隔再次请求 `me` | 连续两次 200；Redis 侧会话 TTL ≈ 7 天且滑动刷新（通过 `me` 可用性间接断言，不直连 Redis） |
| `logout-200` | 登录 → logout → 带原 Cookie 请求 `me` | logout 200 `{ ok: true }`；Set-Cookie 使 `sumire_sid` 过期；后续 `me` 401 |
| `logout-idempotent` | 未登录直接 logout | 200（幂等） |
| `multi-session` | 同一凭据登录两次得到 sid₁/sid₂；用 sid₁ logout | sid₂ 的 `me` 仍 200，sid₁ 的 `me` 401 |
| `login-rate-limit` | 同 IP 1 分钟内连续 6 次错误登录 | 前 5 次 401，第 6 次 429 `{ error }` |
| `api-only-surface` | GET `/`、`/backdoor`、`/backdoor/login` | 一律 404（api 不托管任何页面）；`GET /api/auth/me` 可达（401 而非 404） |
| `cors-credentials` | 带 `Origin: <bookstore>` 的预检与带 Origin 实际请求 | 预检返回 `Access-Control-Allow-Origin: <精确来源>`（非 `*`）且 `Access-Control-Allow-Credentials: true`；非白名单 Origin 无 CORS 头 |

- **运行方式**：

```bash
cd infra/aspire && aspire start          # 拉起 bookstore + api + redis + mongodb
aspire describe api --output json         # 取 api 的 http endpoint
aspire describe bookstore --output json   # 取 bookstore 端点（CORS 用例的 Origin）
cd tests/api && API_BASE_URL=http://localhost:<port> \
  BOOKSTORE_ORIGIN=http://localhost:<bookstore-port> \
  pnpm vitest run
```

`API_BASE_URL` 为必需环境变量，`BOOKSTORE_ORIGIN` 仅 CORS 用例需要；测试运行前用 `GET /api/auth/me` 轮询等待服务就绪（超时 30s）。限速用例放在最后执行（或独立 `describe.sequential`），避免污染其他用例的计数窗口。

- **分支与评审**：基于开发分支创建 `test/<slug>` 分支编写用例，提 PR（description 附用例清单）评审通过后再运行；失败用例由 subagent 按 `docs/engineering` 与契约修复，修复落在同一 test 分支，全绿后合并回开发分支。

### 8.3 e2e 集成测试（`tests/e2e`）

- **技术选型**：Playwright（与 bookstore 现有 e2e 选型一致）；测试目标只有一个前端应用——bookstore（公开页 + `/backdoor` 后台页面），API 行为在 `tests/api` 覆盖；
- **目录结构**：

```
tests/e2e/
├── src/
│   ├── backdoor/
│   │   ├── auth.spec.ts        # 客户端守卫重定向、登录成功/失败、登出
│   │   └── dashboard.spec.ts   # 布局、欢迎语、视觉走查
│   ├── bookstore/
│   │   └── footer-link.spec.ts # 页脚「管理 →」入口
│   └── tools/                  # 排查用临时脚本（不入用例集）
├── playwright.config.ts
├── tests/e2e/AGENTS.md         # 工程约定（创建时写入）
└── package.json
```

- **用例清单**（依据 PRD 验收标准与设计文档）：

| 用例 | 覆盖 AC | 操作路径与断言 |
|------|--------|--------------|
| `auth-redirect` | AC-1 | 未登录访问 `BOOKSTORE_BASE_URL/backdoor` → 先呈加载态，随后 URL 变为 `/backdoor/login`，登录表单可见（客户端守卫基于 `/api/auth/me` 401） |
| `login-success` | AC-2、AC-5 | 登录页输入正确凭据 → 跳转 `/backdoor`，欢迎语可见；`page.reload()` 后仍在仪表盘 |
| `login-failure` | AC-3 | 输入错误密码 → 停留登录页，出现"账号或密码错误"提示；密码框清空可重试 |
| `dashboard-layout` | AC-9 | 仪表盘存在顶部栏（站点名 + 登出按钮）、左侧导航（仅"仪表盘"一项且为选中态）、内容区 |
| `dashboard-content` | AC-10 | 内容区展示欢迎语（含"欢迎回来"），无"敬请期待"类占位文案 |
| `visual-sanity` | AC-11 | 断言根元素背景为 `--color-bg`（`#16121c`）、主按钮使用应援色系；附整页截图供人工核对 |
| `logout-entry` / `logout-invalidates` | AC-6、AC-7 | 点击顶栏"登出" → 回登录页；后退/直接访问 `/backdoor` 再次跳转登录页 |
| `bookstore-footer-link` | AC-12~14 | 打开书店首页，页脚右下角存在「管理 →」链接，`href` 为 `/backdoor`（同站路由）；点击后落在后台登录页 |

- **编写标准**：每条用例编写阶段必须有截图验证——操作前一张、操作完成后一张，确认操作路径真实生效；调试完成后移除截图逻辑，仅保留断言行（视觉走查 `visual-sanity` 的截图保留为 artifact）。无法通过 UI 体现的（如 Cookie 属性、CORS 头）在 API 层断言，e2e 不重复覆盖。
- **运行方式**：

```bash
cd infra/aspire && aspire start
aspire describe bookstore --output json  # bookstore endpoint（页面 + 后台同站）
cd tests/e2e && BOOKSTORE_BASE_URL=http://localhost:<bookstore-port> pnpm playwright test
```

`playwright.config.ts` 不使用 `webServer` 自动拉起（服务由 Aspire 统一管理），`BOOKSTORE_BASE_URL` 由环境变量注入。e2e 通过浏览器真实完成登录，API 可达性由 bookstore 页面行为间接验证（页面内 `NEXT_PUBLIC_API_BASE_URL` 已由 Aspire 注入 bookstore）。

- **分支与评审**：同 API 测试流程——`e2e/<slug>` 分支、PR 附用例清单评审、失败修复同分支、全绿合并。

### 8.4 单元测试（实现侧）

- `servers/api`：bcrypt 校验、会话中间件（有效/失效/伪造 sid）、限速计数逻辑、CORS 白名单与凭证头、种子插入幂等、非 `/api` 路径 404；
- `apps/bookstore`：登录表单状态（提交中禁用、错误提示展示）、`/backdoor` 客户端守卫组件（me 200 渲染 / 401 跳转 / 校验中加载态）、页脚「管理 →」链接渲染。

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地开发 | 联调 | Aspire 编排：bookstore + api + Redis + MongoDB 容器 |
| 生产 | 书店 + 后台页面 | `apps/bookstore` 静态产物托管于 `sumire.live`（SSG 不变，`/backdoor` 页面为静态页 + 客户端守卫） |
| 生产 | 鉴权 API | `servers/api` 独立进程托管于 `api.sumire.live`，配套 Redis/MongoDB，仅暴露 `/api/*` |

### 9.2 配置管理

| 变量 | 说明 |
|------|------|
| `REDIS_URL` | Redis 连接串（api） |
| `MONGODB_URL` | MongoDB 连接串（api） |
| `CORS_ORIGINS` | CORS 允许来源（api；本地为 bookstore 端点，生产为 `https://sumire.live`） |
| `BACKDOOR_USERNAME` | 超管用户名（默认 `supersumire`，仅首次种子） |
| `BACKDOOR_PASSWORD_HASH` | 超管密码 bcrypt 哈希（仅首次种子；生产部署后应立即轮换） |
| `SESSION_SECRET` | 会话签名密钥 |
| `COOKIE_SECURE` | 生产置 true |
| `NEXT_PUBLIC_API_BASE_URL` | 书店页面调用 API 的 base URL（bookstore；本地为 api 端点，生产为 `https://api.sumire.live`） |

## 10. 验收标准

- [ ] 未登录访问 `/backdoor` 跳转 `/backdoor/login`（客户端守卫）
- [ ] 超管凭据登录成功进入仪表盘；错误凭据提示"账号或密码错误"
- [ ] 登出后会话立即失效；多端各自独立
- [ ] 会话 7 天有效，`HttpOnly` Cookie，登录接口限速 5 次/分钟
- [ ] 书店页脚右下角「管理 →」链接可跳转同站 `/backdoor`
- [ ] `servers/api` 仅提供 `/api/*`，非 API 路径一律 404，不托管任何页面
- [ ] CORS 白名单精确来源 + 放行凭证，非白名单来源被拒绝
- [ ] `contract/backdoor-auth.openapi.yaml` 与实现一致
- [ ] 单元测试 + `tests/api` + `tests/e2e` 全绿；Aspire 本地编排可一键启动

## 11. 相关文档

- PRD：[[../product/requirements/draft/2026-08-12-backdoor-auth-prd.md]]
- 后台设计：[[../design/03-backdoor-design.md]]
- 视觉识别：[[../design/01-visual-identity.md]]
- 前端规范：[[frontend-rules.md]]
