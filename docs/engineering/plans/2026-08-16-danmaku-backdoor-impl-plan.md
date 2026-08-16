---
description: 弹幕后台实现方案 v1.0——基于 PRD v1.1 与技术提案 v1.2 的实施计划（契约先行、后端 live-events 域四端点 + 归一化 + 已读水位线、前端 features/danmaku 分栏虚拟化信息流、Aspire 注入上游、API 集成与 e2e；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 弹幕后台 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-16-danmaku-backdoor-prd.md]]（v1.1）
**关联技术提案**: [[../proposals/2026-08-16-danmaku-backdoor-proposal.md]]（v1.2，字段映射已与 Mikibot WebsocketCrawler 交叉校验）
**关联契约**: `contract/live-events.openapi.yaml`（本期新增，契约步骤产出）；`contract/backdoor-auth.openapi.yaml`（复用鉴权口径，不变）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-backdoor`
**契约分支**: `contract/danmaku-backdoor`（自需求总分支切出，PR 回合）
**开发分支**: `feat/danmaku-backdoor`（自契约合并后的需求总分支切出）
**版本**: v1.0（2026-08-16）
**作者**: sumire workflow

本方案将技术提案 v1.2 落实为可执行的实施计划。**前提事实**（已核对主线代码）：

- `servers/api/src/app.ts` 以 `createApp(deps)` 装配，`/api` 下按 `create*Router()` 工厂挂载路由，`AppDeps` 注入依赖；`routes/liveHistory.ts` 是「上游代理 + 依赖注入（`upstreamUrl`/`fetchFn` 可桩）+ 中文错误 `{ error }`」的既有范式，`config.ts` 以 `getEnv(key, fallback)` 管理环境变量（上游地址内置内网缺省、不得抛错）；
- `servers/api/src/rbac/requireRole.ts` 提供角色中间件（未登录 401、角色不足 403）；`db/streamPlans.ts` 是 Mongoose 模型 + 领域函数的既有范式；
- `infra/aspire/apphost.cs` 已对 api 注入 `LIVE_HISTORY_UPSTREAM_URL`（`Environment.GetEnvironmentVariable(...) ?? 内网缺省`），新上游变量照搬该口径；
- `apps/bookstore/app/backdoor/(dashboard)/layout.tsx` 已含会话守卫 + `SideNav`（`NAV_ITEMS` 按角色过滤）；`features/backdoor/api.ts` 导出 `API_BASE_URL`/`API_CONFIGURED`，请求统一 `credentials: "include"`；单元测试置于 `apps/bookstore/tests/unit/`；`@tanstack/react-virtual` **尚未引入**（本期唯一新增前端依赖，D5 已定）；
- `tests/api` 已有 stub 上游范式（`live-history.test.ts`：测试进程内固定端口 HTTP stub + `LIVE_HISTORY_UPSTREAM_URL` 指向 stub）；`tests/e2e` 已有 `page.route` 拦截 API 返回 mock 体的范式（历史直播用例）。

整体顺序：**契约分支产出契约（PR 回合需求总分支）→ 切开发分支 → 后端实现（TDD）→ 前端实现（TDD）→ 编排注入 → API 集成测试 → e2e → 收尾验收**。后端与前端为两个实现 subagent，因共享 `feat/danmaku-backdoor` 分支**串行执行**（后端先行，前端依赖契约与端点形态），避免同分支并发提交冲突。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（主线已有） | 本期目标（依据提案 v1.2） |
|----|-----------------|---------------------------|
| 契约 | 三份既有契约，无 live-events | 新增 `contract/live-events.openapi.yaml`：五端点（检索 / SSE / read / unread / read-all）+ `LiveEvent` schema（提案 §4.2） |
| 事件 API | 仅 `/api/live-history`（公开读代理） | 新增 `/api/live-events` 域：检索代理（member 读）、SSE 组合流（member 读）、已读三写接口（admin 写），全部鉴权 |
| 归一化 | live-history 仅裁剪三字段 | `liveEvents/normalize.ts`：四类 cmd → `LiveEvent`，eventId 派生，缺字段防御式解析，实测样本固化为单测夹具 |
| 已读持久化 | MongoDB 仅有 users / stream_plans | 新增 `live_event_reads` 集合：单条 read/unread 覆盖 + 按类型 watermark 水位线（提案 §4.1） |
| 后台页面 | 仪表盘 / 直播计划 / 用户管理 | 新增 `/backdoor/danmaku`：`features/danmaku/` 模块（Sender 公共组件、四类条目、FeedColumn 虚拟栏、DanmakuDashboard 分栏配置），SideNav 注册入口 |
| 虚拟化 | 无 | 新增依赖 `@tanstack/react-virtual`，全信息流虚拟化 + prepend 滚动锚定 + 回到顶部 |
| 编排 | 四资源（bookstore/api/redis/mongodb） | apphost.cs 追加 `LIVE_EVENTS_UPSTREAM_URL` 注入（照 `LIVE_HISTORY_UPSTREAM_URL` 口径） |
| 测试 | 既有三层测试 | 增量：归一化/已读/SSE 后端单测、前端 hooks/组件单测、tests/api stub 上游集成测试、tests/e2e 弹幕后台关键路径 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-backdoor`；
- 契约在 `contract/danmaku-backdoor` 分支产出（自需求总分支切出），提 PR 回合需求总分支，等待 review 合并；
- 实现工作在 `feat/danmaku-backdoor` 上进行（自契约合并后的需求总分支切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建契约分支

- 自 `prd/danmaku-backdoor` 切出 `contract/danmaku-backdoor`（含 PRD v1.1、提案 v1.2 与本文档）。

**验证**：`git status` 干净，位于 `contract/danmaku-backdoor`。

### 步骤 1：契约 `contract/live-events.openapi.yaml`（subagent，SKILL: z-coding 更新Contract）

加载根 `AGENTS.md` 与既有契约（`contract/live-history.openapi.yaml` 为最近范式）。按提案 §3.1 编写：

- 五端点：`GET /api/live-events`（多 `type` + 分页，200 分页信封 / 401 / 502 `{ error: "上游事件服务不可用" }`）、`GET /api/live-events/stream`（SSE，`text/event-stream`，30s `: ping` 心跳）、`POST /api/live-events/read`、`POST /api/live-events/unread`（Body `{ eventId }`，幂等 200 / 400 / 403）、`POST /api/live-events/read-all`（Body `{ type }`，200 `{ ok, marked }`）；
- `LiveEvent` schema 与提案 §4.2 逐字段一致（sender/medal/scColors/gift/guard/read），错误结构统一 `{ error: string }`；
- 读端点标 member 及以上、写端点标 admin 及以上（描述中注明，与既有契约口径一致）。

提 PR 至 `prd/danmaku-backdoor`，等待 review 合并。

**验证**：YAML 语法合法；端点/字段/状态码与提案 §3.1 无出入。

### 步骤 2：创建开发分支并同步基线

- 契约合并后，自 `prd/danmaku-backdoor` 切出 `feat/danmaku-backdoor`，确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-backdoor`；契约文件在位。

### 步骤 3：后端实现（subagent，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md` 与契约。全程 TDD：先失败测试再实现。改动面（提案 §7）：

1. `src/config.ts`：新增 `liveEventsUpstreamUrl`（读 `LIVE_EVENTS_UPSTREAM_URL`，缺省回退 `http://vtuber.internal.fffdan.com`——**base URL**，端点路径由 upstream 层拼接，不得因缺变量抛错）；
2. `src/liveEvents/upstream.ts`：`fetchRange(types, page, pageSize)`（拼接 `…/event/range`，多 `type=` 重复参数，超时兜底）与 `subscribe(types, onEvent, signal)`（SSE 逐行解析，AbortController 中止）；fetch 可注入便于单测（照 liveHistory `fetchFn` 范式）；
3. `src/liveEvents/normalize.ts`：`toLiveEvent(envelope): LiveEvent | null`——四类 cmd 字段映射与 eventId 派生严格按提案 §4.2 表（含 dm_v2 优先/经典数组回退、SC 备选 `data.user_info`、礼物 `discount_price` 备选与 COMBO_SEND 去重、上船无头像置 null）；解析失败返回 null 并 `console.warn`；2026-08-16 实测样本固化为 `tests/fixtures/` 夹具驱动单测（四类事件 + 缺字段容错 + eventId 稳定性）；
4. `src/db/liveEventReads.ts`：Mongoose 模型（`eventId` 唯一索引、`{ type, kind }` 索引）+ `markRead` / `markUnread` / `markAllRead`（水位线 upsert，只前进不后退）/ `resolveReadState(events)`（单条记录优先于水位线，判定规则按提案 §4.1）；
5. `src/routes/liveEvents.ts`：`createLiveEventsRouter(deps)`——检索（`requireRole("member")`，归一化 + `resolveReadState` 合并后返回，上游失败 502 中文错误）、SSE（`requireRole("member")`，按连接透传，`flushHeaders()` 先下 200 + 头，30s 心跳，`req.on("close")` 中止上游，上游断流指数退避重连 1s→30s）、三个已读写接口（`requireRole("admin")`，幂等，参数缺失 400）；
6. `src/app.ts`：挂载 `/api/live-events`（依赖经 `AppDeps` 注入，照 liveHistory 挂载范式）；
7. 单测覆盖（提案 §8.2 后端行）：401/403 鉴权矩阵、归一化映射正确性、read/unread 幂等与 kind 覆盖、unread 撤销水位线、read-all 水位线只前进、SSE 帧格式与心跳、上游 5xx → 502、非 /api 404 回归。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 4：前端实现（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与契约。注意 `apps/bookstore/AGENTS.md` 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。全程 TDD。改动面（提案 §7）：

1. 新增依赖 `@tanstack/react-virtual`（D5，PR 说明中注明）；
2. `features/danmaku/types.ts`：`LiveEvent`、`LiveEventType`、`ColumnConfig`（Zod schema）；
3. `features/danmaku/api.ts`：检索与三个已读写 fetch 封装（复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径，未配置短路不 fetch）；
4. `features/danmaku/useLiveEventStream.ts`：`EventSource(`${API_BASE_URL}/api/live-events/stream?…`, { withCredentials: true })`，事件按 `eventId` 内存 Set 去重，暴露连接状态；
5. `features/danmaku/useAnchoredFeed.ts`：prepend 锚定（`scrollTop > 阈值` 时按 scrollHeight 差补偿，贴顶保持跟随）+ `scrollTop > 200` 显示回到顶部；
6. `features/danmaku/columns.ts`：`ColumnConfig[]` 读写 localStorage（key `danmaku-backdoor.columns`），Zod 校验非法回退默认 3 栏；
7. 组件：`Sender.tsx`（头像+昵称+牌子按颜色渲染，点击新开 `https://space.bilibili.com/{uid}`，缺头像兜底、无牌子不渲染）、`DanmakuItem.tsx`、`SuperChatItem.tsx`（两行 + scColors 渐变/文字色 + 置灰层）、`GiftItem.tsx`（名称 + 价值元）、`GuardItem.tsx`（guard_level 3/2/1 → 舰长/提督/总督 + 金额 + 数量 + 置灰层）、`FeedColumn.tsx`（虚拟化栏容器 + 回到顶部 + SC/上船列「标记全部已读」按钮带二次确认）、`DanmakuDashboard.tsx`（分栏布局 + 栏位配置 UI，`<1024px` 纵向堆叠纯 CSS）；
8. 已读交互：双击切换（未读→read、已读→unread），乐观更新失败回滚并提示；member 角色不渲染已读交互（与后端 403 口径一致）；
9. `app/backdoor/(dashboard)/danmaku/page.tsx`：路由组装，复用 dashboard 会话守卫；`SideNav.tsx` 的 `NAV_ITEMS` 注册「弹幕后台」入口（全角色可见）；
10. 单测覆盖（提案 §8.2 前端行）：`columns.ts` Zod 回退、锚定偏移计算、船型/金额换算、Sender 缺牌子/缺头像渲染、双击交互状态切换；
11. 视觉约束：仅用 `@theme` token 色、过渡 ≤200ms 且尊重 `prefers-reduced-motion`、无未上线功能占位。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 5：编排注入（随后端步骤一并完成或紧随其后）

- `infra/aspire/apphost.cs`：api 资源追加 `.WithEnvironment("LIVE_EVENTS_UPSTREAM_URL", Environment.GetEnvironmentVariable("LIVE_EVENTS_UPSTREAM_URL") ?? "http://vtuber.internal.fffdan.com")`（照 `LIVE_HISTORY_UPSTREAM_URL` 既有口径，测试时可用环境变量指向 stub）。

**验证**：`cd infra/aspire && aspire start` 后 `aspire describe api --output json` 可见该环境变量。

### 步骤 6：API 集成测试（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md` 与契约（用例只依据契约与 PRD，禁止对照实现）：

1. 新增 `tests/api/src/live-events.test.ts`：测试进程内起 HTTP/SSE stub 上游（固定端口，缺省 `9877`，避开 live-history 的 `9876`），环境变量 `LIVE_EVENTS_STUB_PORT` 可调；Aspire 启动时以 `LIVE_EVENTS_UPSTREAM_URL=http://127.0.0.1:<port>` 注入；
2. 覆盖：四端点未认证 401；member 写操作 403；检索多 type 组合与分页透传、响应合并 `read`；read/unread 幂等与交叉覆盖；read-all 后旧事件已读、unread 单条撤销水位线；SSE 连接收到归一化事件帧与心跳；上游 5xx → 502 中文错误；
3. stub 信封形态模拟真实上游 `{ roomId, type, occurredAt, liveSessionId, payload }`；
4. 更新 `tests/api/AGENTS.md` 运行方式段（新增 live-events 用例启动口径）。

**验证**：Aspire 编排下 `tests/api` 全量通过（含既有用例回归）。

### 步骤 7：e2e（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`：

1. 新增 `tests/e2e/src/backdoor/danmaku.spec.ts`：登录 → 侧边导航进入弹幕后台 → 默认三栏渲染；实时/历史事件以 `page.route` 拦截 `**/api/live-events*` 返回 mock 体（不依赖内网上游可用，照历史直播用例范式）；滚动中注入新事件位置不跳 + 回到顶部；双击 SC 置灰且刷新后保持、再次双击取消；「标记全部已读」整体置灰；member 账号不见已读交互；栏位配置调整后刷新保留；
2. `unconfigured.spec.ts` 补充：未配置形态下 `/backdoor/danmaku` 同为 404、导航无入口；
3. 回归既有 e2e 全量用例。

**验证**：Aspire 编排下配置/未配置两种形态 e2e 分别全绿。

### 步骤 8：收尾与验收

1. 更新 `servers/api/AGENTS.md`（live-events 域路由/模型/配置口径）、`apps/bookstore/AGENTS.md`（弹幕后台模块与 features/danmaku 约定）、根 `AGENTS.md`（contract 清单追加 `live-events.openapi.yaml`）；
2. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；
3. 推送 `feat/danmaku-backdoor` 并提 PR 至 `prd/danmaku-backdoor`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：内网事件服务持续可用（仅服务端可达）；既有鉴权体系（Session-Cookie + Redis + RBAC）、MongoDB、Aspire 编排全部复用不改造；新增前端依赖仅 `@tanstack/react-virtual`；
- **并行协调**：契约先行（后端/前端/测试均依赖）；后端与前端 subagent 串行（共享 feat 分支）；编排注入随后端完成；API 集成测试依赖后端就绪，e2e 依赖前端就绪；
- **风险**（对应提案 §5.2 K1–K7）：
  - B 站 payload 结构漂移——归一化集中一处 + 实测样本夹具单测兜底（步骤 3.3）；
  - 上游 SSE 无事件不刷响应头（实测）——服务端主动 `flushHeaders()` 先下 200 + 头，实现期验证（步骤 3.5）；
  - prepend + 动态测高锚定误差——e2e「滚动中插入位置不跳」断言兜底（步骤 7.1）；
  - 水位线之后乱序到达的历史事件判未读——上游按时间倒序分页，概率低，单条标记可补（提案 K3 已接受）；
  - 跨域 SSE Cookie + CORS——沿用既有白名单 + credentials 口径，e2e 经 Aspire 验证（步骤 7）；
  - stub 端口冲突——live-events 用 `9877`，与 live-history `9876` 隔离（步骤 6.1）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-16-danmaku-backdoor-prd.md]]（v1.1）
- 技术提案：[[../proposals/2026-08-16-danmaku-backdoor-proposal.md]]（v1.2）
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 既有契约：`contract/backdoor-auth.openapi.yaml`、`contract/live-history.openapi.yaml`
- 字段解析参考：[Mikibot WebsocketCrawler](https://github.com/Deliay/Mikibot/tree/main/Mikibot.Crawler/WebsocketCrawler)
