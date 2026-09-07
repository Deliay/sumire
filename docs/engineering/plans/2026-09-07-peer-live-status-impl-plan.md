---
description: 同期直播状态 API 实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/peer-live-status，唯一开发分支 feat/peer-live-status，纯后端 + 契约变更无前端。契约先行（live-status.openapi.yaml 新增 GET /api/live/{name}/status，name 枚举白名单，复用 LiveStatus schema）；servers/api 新增 routes/livePeerStatus.ts（内置 name→roomId 映射防 SSRF、按 name 隔离 30s 缓存、复用 normalizeLiveStatus、stale-if-error 降级零 5xx）+ config.ts 新增 LIVE_PEER_STATUS_UPSTREAM_URL（base 模式）+ app.ts 装配；apphost.cs 补一行 env passthrough 供测试注入 stub；tests/api 复用 9878 stub 扩展三房间路径覆盖白名单 404/归一化/缓存隔离/降级；spec 与 AGENTS.md 同 PR 同步。
type: Permanent
---

# 同期直播状态 API 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-07-peer-live-status-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-07-peer-live-status-proposal.md]]（v1.0）
**需求总分支**: `prd/peer-live-status`（需求总 PR：<https://github.com/Deliay/sumire/pull/119>）
**开发分支**: `feat/peer-live-status`（自需求总分支切出，**唯一开发分支**，契约/实现/测试全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-07）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 z-coding 契约式开发流程：更新 Contract → 编写实现（TDD）→ 编排服务 → 覆盖 API 测试。纯后端 + 契约变更，无前端、无数据库变更、无 e2e。

**前提事实**（已在需求总分支 `prd/peer-live-status` 核对代码现态）：

- 复用资产：`servers/api/src/routes/liveStatus.ts` 已导出 `normalizeLiveStatus`（`:64-84`，防御式归一化，live 布尔强保证）、`LiveStatus` 类型（`:9-13`）、`LIVE_STATUS_CACHE_TTL_SECONDS = 30`（`:5`）、`UPSTREAM_TIMEOUT_MS = 5000`（`:6`）；路由工厂 `createLiveStatusRouter(deps)` 模式（`:97-142`：读缓存 → fetch → 归一化 → 写缓存；catch 后 stale-if-error 重读缓存，仍无 200 `{ ok: false, status: null }`；`sendCached` JSON.parse 失败按降级体处理 `:101-109`；`fetchFn` 可注入 `:90`）。新路由照搬此处理链，`liveStatus.ts` 零改动。
- 缓存抽象：`src/infra/liveStatusCache.ts` 的 `LiveStatusCache` 接口仅 get/set 两方法、与房间号无关（`:4-7`），`createMemoryLiveStatusCache` 缺省实现（`:27-37`）；生产 Redis 实现由 `index.ts` 注入同一实例，按 name 隔离键即可直接复用，不新增注入面。
- 装配现状：`src/app.ts:67-73` 挂载 `api.use("/live/status", createLiveStatusRouter(...))`。新路由挂载 `api.use("/live", createLivePeerStatusRouter(...))`（router 内 `GET /:name/status`）：`/api/live/status` 为 3 段、`/api/live/{name}/status` 为 4 段，前缀互不包含，与挂载顺序无关，无路由冲突（已核实 Express 5 段数语义）。
- 配置模式：`src/config.ts` 的 `getEnv(key, fallback)`（`:1-8`，内置缺省值不抛错）与 base URL 先例 `liveEventsUpstreamUrl`（`:33-36`，env 存 base、路径由代码拼接）——新增 `livePeerStatusUpstreamUrl` 照此模式。
- 契约现状：`contract/live-status.openapi.yaml` 现仅 `/api/live/status` 一个 path（`:9-30`）+ `LiveStatus` schema（`:32-46`）；新增 path 复用该 schema，不新增组件。
- 集成测试现状：`tests/api/src/live-status.test.ts` 的 stub 起在固定端口 9878（`:15`），仅响应 `/api/b/live/1727076670/state/current`（`:33`），`stubCalls` 计数（`:20`），`clearCache` 直连 Redis 删 `live-status:latest`（`:84-98`）。同期端点**复用同一 9878 stub**（扩展响应三个同期房间路径、按房间独立计数），新 env `LIVE_PEER_STATUS_UPSTREAM_URL=http://127.0.0.1:9878`（base）与既有 `LIVE_STATUS_UPSTREAM_URL`（含路径完整 URL）同端口不同形态，互不干扰。
- 编排现状：`infra/aspire/apphost.cs:27-31` 三个上游 env 均为 `WithEnvironment("X", Environment.GetEnvironmentVariable("X") ?? 缺省)` passthrough 模式。提案 §5.2 称「Aspire 编排无需变更」仅指无新增资源；**集成测试要把 api 的同期上游指向 stub，必须补一行同款 passthrough**（列入步骤 3，属对提案的细化而非偏差）。
- 单测模式：`servers/api/tests/liveStatus.test.ts`——`createApp` + 内存 SessionStore/RateLimiter + `memCache()` + `vi.stubGlobal("fetch", fetchSpy)` + 直接调用 `app(req, res)` 断言（`:1-80`）；新增 `livePeerStatus.test.ts` 照此组织。
- 文档同步面：上线 PR 内需更新 `docs/engineering/spec/backend-live.md`、`servers/api/AGENTS.md`（关键约定补端点与缓存键）、`tests/api/AGENTS.md`（live-status 用例小节补同期 stub 与 env）；根 `AGENTS.md` 契约清单已含 `live-status.openapi.yaml`，无需变更。

整体顺序（**串行**，唯一开发分支 `feat/peer-live-status`，依赖链明确：契约 → 实现 → 编排 → 集成测试 → 文档收尾）：
**切开发分支 → 契约更新 → 后端实现（config → livePeerStatus.ts → app.ts，TDD 配单测）→ apphost.cs passthrough → API 集成测试 → spec/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 契约 | `live-status.openapi.yaml` 仅 `/api/live/status` | 新增 `/api/live/{name}/status`（name 枚举 viridis/komichi/chu2u，`security: []`，200/404，复用 LiveStatus schema）；`info.description` 补多房间口径 |
| 同期状态端点 | 无 | `servers/api/src/routes/livePeerStatus.ts`：白名单映射 → 按 name 缓存（`live-peer-status:{name}`，TTL 30s）→ 代理上游 `state/current` → 归一化 → 同口径降级 |
| 配置 | 无同期上游配置项 | `config.ts` 新增 `livePeerStatusUpstreamUrl`（env `LIVE_PEER_STATUS_UPSTREAM_URL`，缺省 `http://vtuber.internal.fffdan.com`，base 模式） |
| 装配 | `app.ts` 仅挂载既有 liveStatus | `app.ts` 增挂 `api.use("/live", createLivePeerStatusRouter(...))`，与 liveStatus 共享同一解析后的 cache 实例 |
| 编排 | apphost.cs 三个上游 env passthrough | 补一行 `LIVE_PEER_STATUS_UPSTREAM_URL` passthrough（无新资源） |
| 集成测试 | live-status.test.ts 仅覆盖本人房间 | 新增同期 describe 分组：stub 扩展三房间路径 + 按房间计数；清理 `live-peer-status:*` 缓存键 |
| 文档 | spec/AGENTS.md 无同期端点记录 | 同 PR 同步 `backend-live.md`、`servers/api/AGENTS.md`、`tests/api/AGENTS.md` |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/peer-live-status`；
- 开发工作（契约 + 实现 + 全部测试）在**唯一开发分支** `feat/peer-live-status` 上进行（自 `prd/peer-live-status` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/peer-live-status` 切出 `feat/peer-live-status` 并推送。

**验证**：`git branch --show-current` 为 `feat/peer-live-status`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：契约更新（contract/live-status.openapi.yaml）

- 新增 path `/api/live/{name}/status`：`get`，`security: []`；path 参数 `name` 必填，`schema.enum: [viridis, komichi, chu2u]`；200 响应与既有端点完全同构（`{ ok: boolean, status: LiveStatus | null }`，`$ref` 复用 `LiveStatus`）；404 响应 `{ error: string }`（中文文案，仅用于 name 不在白名单）；description 写明「房间号服务端内置不暴露、30s 缓存、上游失败 200 降级不 5xx」口径（提案 §3 为蓝本）；
- `info.description` 补充多房间口径说明（本人房间固定内置 + 同期白名单映射）；
- 不新增 schema 组件，不改既有 path。

**验证**：契约文件可被 OpenAPI 校验工具解析；`git diff` 仅新增不改旧。

### 步骤 2：后端实现（servers/api，TDD）

先写失败单测再实现。加载 `servers/api/AGENTS.md` 与 `docs/engineering/backend-rules.md`。

1. `src/config.ts`：新增 `livePeerStatusUpstreamUrl: getEnv("LIVE_PEER_STATUS_UPSTREAM_URL", "http://vtuber.internal.fffdan.com")`（base URL，内置缺省值、不得抛错，注释口径同 liveEventsUpstreamUrl）；
2. `src/routes/livePeerStatus.ts`（新增）：
   - 模块内置常量 `PEER_ROOMS: Record<string, string> = { viridis: "1727071052", komichi: "1700301235", chu2u: "1727074031" }`；
   - `createLivePeerStatusRouter(deps: { upstreamBaseUrl, cache, fetchFn? })`，`router.get("/:name/status", …)`；
   - 白名单校验：`PEER_ROOMS[req.params.name]` 不存在 → 404 `{ error: "未知的同期主播" }`，**直接返回，不请求上游**（精确匹配、大小写敏感）；
   - 处理链照搬 liveStatus.ts：缓存键 `live-peer-status:${name}`、TTL 复用导入的 `LIVE_STATUS_CACHE_TTL_SECONDS`、fetch `${upstreamBaseUrl}/api/b/live/${roomId}/state/current`（`AbortSignal.timeout(5000)`）→ `normalizeLiveStatus`（自 `./liveStatus` 导入，零改动复用）→ 写缓存返回 `{ ok: true, status }`；
   - 失败路径：catch 后 stale-if-error 重读同键缓存，仍无 → 200 `{ ok: false, status: null }`；任何异常不冒泡为 5xx；roomId 只来自内置映射（SSRF 面为零）；
3. `src/app.ts`：将 cache 解析提为共享局部变量（`const liveStatusCache = deps.liveStatusCache ?? createMemoryLiveStatusCache()`），同时传给既有 liveStatus 与新路由；增挂 `api.use("/live", createLivePeerStatusRouter({ upstreamBaseUrl: config.livePeerStatusUpstreamUrl, cache: liveStatusCache }))`；`index.ts` 无需变更；
4. 单测 `servers/api/tests/livePeerStatus.test.ts`（照 liveStatus.test.ts 模式）：三个 name 各自 fetch URL 含正确 roomId（映射不落错房间）；未知 name 与大小写变体（`Viridis`）404 且 fetch 零调用；缺 `title`/`startedAt` 归一化为 null；同 name 二次请求命中缓存（fetch 一次）、不同 name 各自计数；上游 5xx/非法 JSON/无法归一化时有缓存返回缓存、无缓存 200 `{ ok: false, status: null }`；既有 liveStatus 用例不动仍绿。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：Aspire 编排（apphost.cs 一行 passthrough）

- `infra/aspire/apphost.cs` 在既有上游 env 区块追加：`WithEnvironment("LIVE_PEER_STATUS_UPSTREAM_URL", Environment.GetEnvironmentVariable("LIVE_PEER_STATUS_UPSTREAM_URL") ?? "http://vtuber.internal.fffdan.com")`（与 `:27-31` 同款，供测试指向 stub，无新资源）。

**验证**：`cd infra/aspire && aspire start`，`aspire describe` 四资源 Running/Healthy；未注入 env 时 api 使用缺省值正常启动。

### 步骤 4：API 集成测试（tests/api，SKILL: z-test）

- `tests/api/src/live-status.test.ts` 新增 describe 分组「GET /api/live/{name}/status（同期，公开读代理）」，用例只依据契约与 PRD 编写：
  - stub 扩展：响应 `/api/b/live/1727071052|1700301235|1727074031/state/current` 三条路径，按房间独立计数（`stubCallsByRoom`），复用 live/offline/invalid/non-normalizable/hang 模式；
  - `clearCache` 增删 `live-peer-status:viridis|komichi|chu2u` 三键；
  - 用例：三个白名单 name 无 Cookie 200 且归一化结构正确（`live` 布尔）；各 name 上游调用路径含对应 roomId；未知 name 与大小写变体 404 `{ error }` 且 stub 零调用；30s 内同 name 二次请求 stub 计数不变、不同 name 独立；上游 hang/invalid/non-normalizable → 无缓存 200 `{ ok: false, status: null }`，有缓存返回缓存；某 name 持续失败时其余 name 正常；全程无 5xx；既有本人房间用例不动仍绿；
- 运行方式：`cd infra/aspire && LIVE_STATUS_UPSTREAM_URL=http://127.0.0.1:9878/api/b/live/1727076670/state/current LIVE_PEER_STATUS_UPSTREAM_URL=http://127.0.0.1:9878 aspire start`，注入 `API_BASE_URL`/`REDIS_URL` 跑 `pnpm vitest run src/live-status.test.ts`；
- 同步 `tests/api/AGENTS.md` live-status 用例小节（9878 stub 同时承载同期三房间路径、新增 env 说明）。

**验证**：新增与既有用例全部通过。

### 步骤 5：收尾与验收

1. 更新 `docs/engineering/spec/backend-live.md`：新增同期端点小节（路径、白名单映射口径、缓存键族 `live-peer-status:{name}`、降级口径、env 配置项）；
2. 更新 `servers/api/AGENTS.md`：关键约定补 `/api/live/{name}/status` 条目（契约文件、白名单、缓存键、降级口径、env）；
3. 核对提案 §10 与 PRD §1.3 验收标准全量通过（三个 name 无登录 200、未知 name 404 零上游调用、缓存与降级、无 roomId/上游地址泄露、既有端点零回归、`pnpm lint && pnpm test` 全绿）；
4. 推送 `feat/peer-live-status`，提 PR 回合 `prd/peer-live-status`（PR #119 随之更新）。

## 4. 依赖与风险

- **依赖**：上游 `GET /api/b/live/{roomId}/state/current` 对三个同期房间可用（与既有 live-status 同一上游服务）；本地 Aspire 与容器运行时可用（集成测试编排）；
- **风险**：上游对同期房间返回结构与本人房间不一致——`normalizeLiveStatus` 已防御式兼容多字段名，且 PRD 仅强保证 `live` 布尔，风险可控；若实测结构超出兼容面，按 liveStatus 先例实测后回写契约/spec；
- **风险**：缓存击穿（并发未命中重复拉上游）与既有端点同水平，30s TTL 低基数，可接受不处理；
- 无前端、无数据库、无 e2e 范围蔓延；Aspire 变更仅限一行 env passthrough。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-07-peer-live-status-prd.md]]
- 技术提案：[[../proposals/2026-09-07-peer-live-status-proposal.md]]
- 契约：`contract/live-status.openapi.yaml`
- 后端直播域 Spec（现态）：`../spec/backend-live.md`
- 后端规范：[[../backend-rules.md]]
