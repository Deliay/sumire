# 堇色书屋 · 枝堇 Sumire 非官方粉丝站

枝堇 Sumire（VirtuaReal 二十八期）的非官方粉丝网站与工具集。应援色 `#b4a6bf`。

> 本站为非官方粉丝作品，与主播本人及所属社团无关。角色立绘与相关素材版权归主播及所属社团所有，内容以官方公开信息为准，禁止二次设定。

## 功能

**公开站（`apps/bookstore`）**

- **首页整页滚动叙事**：8 屏 deck（首页 → 档案 P1~P5 → 日历 → 素材），一次手势一屏，hash 可定位可分享，配合视差、光晕粒子与整页翻页转场。
- **档案 `/about`**：信息 / 设定 / 喜好 / 历程 / 轶闻五组内容，与首页档案屏同源组件。
- **素材 `/assets`**：按分类展示的素材网格，构建期生成缩略图。
- **日历 `/calendar`**：直播计划 + 历史直播混合展示，月/周二视图，移动端周视图。
- **录播 `/recordings`**：直连外部录播服务，列表、分组折叠、分页、原生下载与音频流。
- **回放 `/recordings/replay`**：FLV 播放 + 浮层弹幕 + 虚拟化事件时间轴与点击跳转，支持双全屏与未缓冲近似 seek。
- **棉花糖 `/topics`**：主题公开收集页与进行中主题列表（匿名提问 / 留言）。

**后台（`/backdoor`）**

- 登录、强制改密、`superadmin / admin / member` 三级角色守卫。
- 仪表盘、直播计划管理、周表图片生成（Canvas 渲染可自定义排版）。
- 弹幕看板：三栏信息流、SSE 实时追加、已读标记、合并 / 过滤开关、在线人数。
- 弹幕检索与弹幕工具（弹幕投票等纯前端工具）。
- 用户管理、棉花糖主题管理与幻灯片放映、AI 投递审核。

**服务端（`servers/api`）**

- 纯 `/api/*` Express 5 服务：会话鉴权与 RBAC、用户管理、直播计划 CRUD。
- 直播域代理与归一化：live-history、live-status / 同行直播状态、live-events 分页 / SSE / 已读水位线 / 公开回放取数、B 站封面代理。
- 棉花糖主题、投递限速与 AI 审核队列。

## 仓库结构

```
apps/bookstore/     前端静态站（Next.js App Router，SSG + 客户端后台）
servers/api/        后端 API（Express 5 + TypeScript strict）
contract/           API 契约（OpenAPI，单一事实源）
tests/api/          API 黑盒集成测试（Vitest，针对运行中的服务）
tests/e2e/          端到端测试（Playwright，公开页 + /backdoor）
infra/aspire/       本地编排 AppHost（bookstore + api + Redis + MongoDB）
docs/               产品 / 工程 / 设计文档
patches/            依赖补丁（mpegts.js 字节偏移续播）
```

技术栈：Next.js 16（App Router，`output: "export"`）+ React 19 + Tailwind CSS v4；Express 5 + MongoDB + Redis；pnpm workspace；Vitest + Playwright；.NET Aspire 本地编排。

## 快速开始

### 前置依赖

- Node.js 24+、pnpm 11.3（`corepack enable` 后自动读取 `packageManager`）
- Docker 或 Podman（Aspire 用于拉起 Redis / MongoDB）
- .NET SDK 与 Aspire CLI（仅本地编排需要）

### 本地启动

```bash
pnpm install
cd infra/aspire
aspire start
```

Aspire 会启动四个资源并互联：

| 资源 | 说明 |
|------|------|
| `redis` | 会话存储、登录限速计数、直播数据缓存 |
| `mongodb` | `sumire` 库：用户、直播计划、弹幕已读、棉花糖 |
| `api` | 后端 API（注入 Redis / MongoDB / 会话密钥 / 上游地址） |
| `bookstore` | 前端 dev server（注入 `NEXT_PUBLIC_API_BASE_URL`） |

查看实际访问地址：

```bash
aspire describe bookstore --output json
aspire describe api --output json
```

开发用种子超管：`supersumire` / `salamander`（首次登录后需修改密码）。

### 环境变量

前端（构建期注入，未配置时对应功能自动降级、导航无入口）：

| 变量 | 作用 |
|------|------|
| `NEXT_PUBLIC_API_BASE_URL` | 后台 / 日历 / 首页直播组件的 API 基址；为空时 `/backdoor`、`/calendar` 呈现站点 404 且不发请求 |
| `NEXT_PUBLIC_RECORDINGS_BASE_URL` | 外部录播服务基址；为空时 `/recordings` 展示「服务未配置」且不发请求 |
| `NEXT_PUBLIC_BASE_PATH` | 静态导出的子路径（GitHub Pages 用） |

后端主要变量（完整定义见 `servers/api/src/config.ts`，本地由 Aspire 自动注入）：

| 变量 | 作用 |
|------|------|
| `PORT` / `CORS_ORIGINS` | 监听端口 / CORS 精确白名单 |
| `REDIS_URI` / `ConnectionStrings__mongodb` | Redis 与 MongoDB 连接 |
| `SESSION_SECRET` | 会话签名密钥 |
| `BACKDOOR_USERNAME` / `BACKDOOR_PASSWORD_HASH` | 种子超管账号 |
| `LIVE_HISTORY_UPSTREAM_URL` / `LIVE_EVENTS_UPSTREAM_URL` / `LIVE_STATUS_UPSTREAM_URL` / `LIVE_PEER_STATUS_UPSTREAM_URL` | 直播上游地址（测试时可指向 stub） |
| `SUMIRE_REVIEW_AI_*` | 棉花糖 AI 审核（未配置则跳过） |

## 常用命令

仓库根目录没有聚合脚本，按包执行：

```bash
# 前端
pnpm -C apps/bookstore dev           # 开发
pnpm -C apps/bookstore build         # 生成缩略图 / original webp + 静态构建（out/）
pnpm -C apps/bookstore lint
pnpm -C apps/bookstore test          # Vitest 单元测试
pnpm -C apps/bookstore test:e2e      # Playwright（需 Aspire 已在运行）

# 后端
pnpm -C servers/api dev
pnpm -C servers/api build
pnpm -C servers/api lint             # tsc --noEmit
pnpm -C servers/api test

# 集成测试（需 Aspire 已在运行）
pnpm -C tests/api test
pnpm -C tests/e2e test
```

测试端点通过 `aspire describe` 注入：

```bash
export API_BASE_URL=$(aspire describe api --output json | jq -r '.endpoints[0].url')
export BOOKSTORE_BASE_URL=$(aspire describe bookstore --output json | jq -r '.endpoints[0].url')
export BOOKSTORE_ORIGIN=$BOOKSTORE_BASE_URL
pnpm -C tests/api test
pnpm -C tests/e2e test
```

提交前前端须 `pnpm lint && pnpm test && pnpm build` 全绿。

## 文档

| 目录 | 内容 |
|------|------|
| [`docs/product/spec/`](docs/product/spec/) | 产品功能现态（单模块一文件） |
| [`docs/product/requirements/`](docs/product/requirements/) | PRD（时点文档，带日期前缀） |
| [`docs/engineering/spec/`](docs/engineering/spec/) | 架构与实现现态（前端 / 后端 / 测试 / 基础设施） |
| [`docs/engineering/proposals/`](docs/engineering/proposals/) | 技术方案（时点决策，带日期前缀） |
| [`docs/design/`](docs/design/) | 视觉识别、页面与后台设计规范 |
| [`contract/`](contract/) | OpenAPI 契约，端点与字段以契约为准 |

规则：行为或架构变更须在同一个 PR 内同步更新对应 spec；PRD / proposal 上线后归档到 `archived/`。开发前请阅读 [`AGENTS.md`](AGENTS.md)、[`docs/engineering/frontend-rules.md`](docs/engineering/frontend-rules.md) 或 [`docs/engineering/backend-rules.md`](docs/engineering/backend-rules.md)。

## 部署

- **前端**：`output: "export"` 静态导出到 `apps/bookstore/out`，push 到 `release`（`apps/bookstore/**` 等路径变更）触发 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 构建并发布 GitHub Pages，线上域名 <https://sumire.live>。
- **后端**：`servers/api/Dockerfile` 容器化，push 到 `release` 触发 [`.github/workflows/build-api-image.yml`](.github/workflows/build-api-image.yml) 构建镜像。

## 贡献

- 分支命名 `<type>/<slug>`（`prd/…` 文档分支、`feat/…` 开发分支），只 merge，禁止 rebase / squash。
- 开发遵循 TDD；本地联调统一用 Aspire 编排。
- 未上线的功能不得在 UI 中暴露占位入口。
- 提交 PR 前跑通相关测试与 lint，并同步文档 spec。

## 版权与免责声明

本项目为非官方粉丝作品，与枝堇 Sumire 本人及 VirtuaReal 无关。站内立绘、图片与其他角色素材版权归主播及所属社团所有，仅用于非商业性的应援展示；如相关方要求，将及时移除。站内文字内容以官方公开信息为准，不含二次设定。
