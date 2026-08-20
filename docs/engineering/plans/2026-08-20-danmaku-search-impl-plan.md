---
description: 弹幕检索实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（契约先行新增 GET /api/live-events/search；服务端代理上游 event/search 复用归一化/罗马音/已读管道；前端新增 /backdoor/danmaku/search 防抖检索页 + 卡片换行瀑布流 + 加载更多；TDD 步骤、并行分工、验证与验收）
type: Permanent
---

# 弹幕检索 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-20-danmaku-search-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-20-danmaku-search-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-search`
**开发分支**: `feat/danmaku-search`（自需求总分支切出，**唯一开发分支**）
**版本**: v1.0（2026-08-20）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。前提事实（已在需求总分支核对代码现态）：

- `servers/api/src/liveEvents/upstream.ts:8-9`：`EVENT_API_PREFIX = "/api/b/live/1727076670"`、`UPSTREAM_TIMEOUT_MS = 5000`；`:20-25` `UpstreamPage { total, page, pageSize, items: UpstreamEnvelope[] }`；`:29-33` `LiveEventsUpstream` 接口现仅 `fetchRange`/`subscribe`；`:35-47` `buildUrl`/`buildRangeUrl`（base 去尾斜杠 + 前缀 + 查询参数）；`:54-65` `parsePage` 校验 `items` 数组否则抛「上游事件响应非法（缺 items 数组）」；`:67` 工厂 `createLiveEventsUpstream(baseUrl, fetchFn?)` 支持 fetch 注入；`:71-77` `fetchRange` 以 `AbortSignal.timeout(5000)` 请求、`!res.ok` 抛错——`search` 方法全套仿此；
- `servers/api/src/routes/liveEvents.ts:48-53`：`parsePageParam(value, fallback, max?)` 非正整数/超限 → null → 400 `{ error: "分页参数非法" }`（pageSize 上限 100）；`:63-66` `upstreamUnavailable` 统一 502 `{ error: "上游事件服务不可用" }`；`:69-90` 既有管道 `normalizeAll` → `resolveReadState` → `annotateRomaji`；`:100` `router.get("/", requireRole("member"), …)`；`:124-129` 响应信封透传上游 total/page/pageSize；
- 装配点 `servers/api/src/app.ts:63-69`：`createLiveEventsRouter({ upstream: deps.liveEventsUpstream ?? createLiveEventsUpstream(...) })`，stub 经 `AppDeps.liveEventsUpstream`（`app.ts:22`）注入——新增 `search` 后注入点零改动；
- 契约 `contract/live-events.openapi.yaml:9-61`：既有 `/api/live-events` GET 的参数/200 分页信封（`items` `$ref: LiveEvent`）/400/502（`Error` schema + 中文 example）/401（`#/components/responses/Unauthorized`）写法，新增 `/api/live-events/search` 逐项仿照；`LiveEvent` schema 见 `:186-266`；
- 前端 `apps/bookstore/features/danmaku/api.ts:1,21-33`：复用 `features/backdoor/api.ts:23-46` 的 `request<T>()`（`credentials: "include"`，未配置 base 短路），`listLiveEvents` 以 `URLSearchParams` 拼参——`searchLiveEvents` 仿此；类型经 `./types` 的 Zod schema（`types.ts:9-64`，与契约逐字段一致）；
- 展示组件：`components/Sender.tsx:6-15`（`{ sender, compact?, guardLevel? }`）；`components/DanmakuItem.tsx:36-49` 表情渲染口径（`emote.url` 存在渲染 `<img>`，`isSmallEmote` 最大边 ≤32px 决定 `max-h-8`/`max-h-16`）；**danmaku 域无任何事件时间渲染**（`format.ts` 无时间格式化函数，全库仅 `features/backdoor/components/SessionNote.tsx:14` 用 `toLocaleDateString("zh-CN", …)`）——PRD「沿用看板的时间格式」无现成落点，本期新增 `formatOccurredAt`（口径见步骤 3.2，spec 同步时记录）；
- 页头 `app/backdoor/(dashboard)/danmaku/page.tsx:28-59`：左标题右工具区，按钮范式 `rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim hover:border-flower hover:text-ink`（`:54`）——「弹幕检索」入口仿此加 `Link`；鉴权沿用 `(dashboard)/layout.tsx:14-19` 客户端守卫，页面保持 `"use client"` + SSG；
- 测试基底：`tests/api/src/live-events.test.ts:149-195` 进程内 stub 上游（`STUB_PORT = LIVE_EVENTS_STUB_PORT ?? 9877`，按 pathname 分发，`rangeMode` 切换上游行为，`lastRangeSearch` 记录透传查询）；describe 组织见 `:310/:341/:432/:628`；e2e `tests/e2e/src/backdoor/danmaku.spec.ts:102-207` `stubLiveEvents` 以 `page.route("**/api/live-events**")` 分发，未 mock 分支返 404——`/api/live-events/search` 需在同 handler 加分支；登录夹具 `helpers.ts:5-13` `loginViaUi`；
- 单测基底：`apps/bookstore/tests/unit/` 已有 17 个 danmaku 相关测试文件（`danmaku-api.test.ts`/`danmaku-format.test.ts`/`danmaku-items.test.tsx` 等组织口径可仿）。

整体顺序：**切开发分支 → 契约先行 → 服务端与前端并行实现（TDD，各一个 subagent）→ API 集成测试与 e2e → 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 契约 | 无检索端点 | 新增 `GET /api/live-events/search`（stringCriteria 1–200 必填、page/pageSize≤100、200 分页信封、400/401/502） |
| 服务端代理 | `LiveEventsUpstream` 仅 `fetchRange`/`subscribe` | 新增 `search(criteria, page, pageSize)`，复用 base/前缀/5s 超时/错误包装 |
| 服务端路由 | 仅 `GET /`（range 代理） | 新增 `GET /search`：`requireRole("member")` → 参数校验 → upstream.search → 归一化 → 罗马音 → 已读合并；上游异常 → 502 |
| 前端检索页 | 不存在 | `/backdoor/danmaku/search`：顶部搜索框（300ms 防抖 + 回车 + AbortController 取消）、卡片换行瀑布流、`<mark>` 关键词高亮、三态反馈、「加载更多」append |
| 看板入口 | 无 | 看板页头工具区新增「弹幕检索」链接，检索页对称提供「返回看板」 |
| 测试 | 三层测试全绿 | 增量：服务端单测、`tests/api` /search 分组、前端高亮/hook/卡片单测、e2e 检索页主流程；既有用例零适配 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-search`；
- 开发工作全部在**唯一开发分支** `feat/danmaku-search` 上进行（自 `prd/danmaku-search` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-search` 切出 `feat/danmaku-search`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-search`。

### 步骤 1：契约先行（`contract/live-events.openapi.yaml`）

仿 `:9-61` 既有端点写法新增 `/api/live-events/search` GET：

- 参数：`stringCriteria`（query，required，`type: string, minLength: 1, maxLength: 200`，描述注明 trim 后非空）；`page`（integer，minimum 1，default 1）；`pageSize`（integer，minimum 1，maximum 100，default 20——本端点缺省 20，区别于 range 端点的 50）；
- 响应：200 复用分页信封（`required: [total, page, pageSize, items]`，`items` `$ref: LiveEvent`）；400/502 `$ref: Error` + 中文 example；401 `$ref: Unauthorized`；
- summary/description 注明「member 及以上」「代理上游 event/search」语义。

**验证**：按既有契约 lint 口径校验通过（参考 `tests/api` 或 CI 中的契约校验命令）。

### 步骤 2：服务端实现（subagent，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md` 与契约。全程 TDD（`servers/api` 内 Vitest 单测先行）：

1. `upstream.ts`：`LiveEventsUpstream` 接口增 `search(params: { stringCriteria: string; page: number; pageSize: number }): Promise<UpstreamPage>`；实现仿 `fetchRange`（`:71-77`）——`buildSearchUrl`（base + 前缀 + `/event/search` + `stringCriteria`/`page`/`pageSize` 查询参数，`URLSearchParams` 编码）、`AbortSignal.timeout(5000)`、`!res.ok` 抛错、`parsePage` 复用；单测覆盖 URL 拼接（中文关键词编码）、透传、非 2xx 抛错、缺 items 抛错；
2. `routes/liveEvents.ts`：`router.get("/search", requireRole("member"), …)`——`stringCriteria` 缺失/trim 后为空 → 400 `{ error: "stringCriteria 不能为空" }`；长度 >200 → 400 `{ error: "stringCriteria 超长" }`；`page`/`pageSize` 复用 `parsePageParam`（fallback 20、上限 100）→ 400 `{ error: "分页参数非法" }`；成功路径复用 `:69-90` 管道（`normalizeAll` → `resolveReadState` → `annotateRomaji`），信封透传上游 total/page/pageSize；上游抛错 → `upstreamUnavailable`（502）；
3. 单测覆盖：鉴权（未登录 401 由 `requireRole` 既有保证）、参数各 400 分支、管道复用（mock upstream）、502 分支。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端实现（subagent，TDD，可与步骤 2 并行）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`（注意 AGENTS.md 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南）。全程 TDD，新增 `features/danmaku/search/` 模块：

1. **`search/api.ts`**：`searchLiveEvents(criteria, page, pageSize = 20, signal?)`——复用 `request()`（`features/backdoor/api.ts:23-46`），`URLSearchParams` 拼 `stringCriteria`/`page`/`pageSize`；若 `request()` 不支持 `signal` 透传则最小改动扩展其选项（保持既有调用零影响）；返回类型沿用 `LiveEventsPage` 口径；单测仿 `danmaku-api.test.ts`；
2. **`search/highlight.ts`**：纯函数 `splitByKeyword(content: string, keyword: string): { text: string; hit: boolean }[]`——`indexOf` 循环朴素子串切分（规避正则元字符），连续命中合并；空关键词/未命中返回单段 `hit: false`；另新增 `formatOccurredAt(iso: string): string`（`new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })`——danmaku 域无既有时间格式可沿用，此为本期新增口径，入 spec）；单测覆盖命中/多段/未命中/空关键词/正则元字符关键词/时间格式；
3. **`search/useDanmakuSearch.ts`**：状态 `{ criteria, results, total, page, status: "idle"|"loading"|"error"|"done", loadingMore }`；输入变化 → 防抖 300ms → 置 criteria 并重置 `results`/`page=1`；回车立即 flush 当前输入；criteria 或 page 变化触发请求，每次新建 `AbortController`、effect 清理 abort（竞态以 abort 为准，不加序号戳）；`loadMore` 置 `page+1` 并 append、进行中防重复；`results.length >= total` 隐藏「加载更多」；追加失败保留已有结果、`status` 不回退；单测以 fake timers + mock api 覆盖防抖、取消旧请求、append、错误态；
4. **`search/components/`**：
   - `SearchBox.tsx`：全宽输入框 + 搜索图标 + 清除按钮，`aria-label="弹幕检索关键词"`，`maxLength={200}`，受控输入回调；
   - `SearchResultCard.tsx`：复用 `Sender`（`compact`）+ 内容区（`splitByKeyword` 命中段包 `<mark>`，token 背景如 `bg-eye/30`）+ emote 渲染口径仿 `DanmakuItem.tsx:36-49` + `formatOccurredAt` 时间；无双击已读、无 `select-none`；
   - `SearchResults.tsx`：容器 `flex flex-wrap gap-3`，卡片 `w-full sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]`；三态（加载中指示/「无匹配弹幕」/错误文案 + 重试按钮，502 口径「搜索服务不可用」）+ 总数「共 N 条」+ 末尾「加载更多」按钮（`results.length >= total` 隐藏、loadingMore 禁用）；
5. **页面与入口**：新增 `app/backdoor/(dashboard)/danmaku/search/page.tsx`（`"use client"`：页头「弹幕检索」+ 返回看板 `Link` + SearchBox + SearchResults）；`danmaku/page.tsx:28-59` 页头工具区按 `:54` 按钮范式加「弹幕检索」`Link`；
6. 视觉约束：仅 `@theme` token 色（禁硬编码）；过渡 ≤200ms；无未上线功能占位。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：API 集成测试（subagent，SKILL: z-test，黑盒只依契约，可与步骤 2/3 并行启动、服务端就绪后跑绿）

加载 `tests/api/AGENTS.md`。`tests/api/src/live-events.test.ts` 新增 `GET /api/live-events/search（检索代理）` describe：

- stub 上游（`:154-195`）加 `/event/search` 分支（仿 range 分支，`searchMode: "ok"|"error"|"empty"` 切换，记录 `lastSearchQuery` 供透传断言）；
- 鉴权矩阵：未登录 401、member 200；
- 参数：`stringCriteria` 缺失/空/纯空白/201 字符 → 400；`page=0`/`pageSize=0`/`pageSize=101` → 400；
- 代理：`stringCriteria`/`page`/`pageSize` 透传断言、响应信封形状、items 已归一化且含 `read` 字段；
- 上游 error 模式 → 502 `{ error: "上游事件服务不可用" }`。

**验证**：Aspire 编排（`LIVE_EVENTS_UPSTREAM_URL=http://127.0.0.1:9877`、`LIVE_EVENTS_STUB_PORT=9877`）下 `tests/api` 全量通过（既有用例零适配）。

### 步骤 5：e2e（subagent，SKILL: z-test，前端就绪后）

加载 `tests/e2e/AGENTS.md`。`tests/e2e/src/backdoor/danmaku.spec.ts`：

- `stubLiveEvents`（`:102-207`）handler 加 `GET /api/live-events/search` 分支：按 `stringCriteria` 在 mock 事件 `content` 中过滤、按 `page`/`pageSize` 分页返回信封，并提供 `setSearchDown` 切 502；
- 新增用例（命名 `danmaku-search-<slug>: 中文描述`）：登录后从看板页头进入检索页 → 输入关键词出结果卡片（总数、`<mark>` 高亮）→ 加载更多追加且累计达 total 后按钮消失 → 空关键词回到引导态 → 502 失败态 + 重试恢复 →「返回看板」回跳；
- 既有看板用例全量回归（页头新增链接不影响既有断言）。

**验证**：Aspire 编排下 `tests/e2e` 全量通过。

### 步骤 6：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`（检索模块、入口、三态、分页口径现态）与 `docs/engineering/spec/backend-live.md`（/search 端点）、`docs/engineering/spec/frontend-bookstore.md`（search 模块、`formatOccurredAt` 口径）；PRD 与提案为时点文档，不改原文；
2. 更新 `servers/api/AGENTS.md`（/search 端点约定）与 `apps/bookstore/AGENTS.md` 弹幕看板约定段（`features/danmaku/search/` 各文件职责）；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；
4. 推送 `feat/danmaku-search` 并提 PR 至 `prd/danmaku-search`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：上游 `event/search` 已交付且实测信封与 range 一致（提案 §1.1）；既有归一化/罗马音/已读管道零改动；无新增 npm 依赖、无数据库/编排/配置变更；
- **并行协调**：步骤 1（契约）是全部下游的前置；步骤 2 与步骤 3 并行（服务端、前端两个 subagent）；步骤 4 黑盒只依契约可与实现并行编写、服务端就绪后跑绿；步骤 5 依赖步骤 3 就绪；`request()` 若需扩展 `signal` 透传由前端 subagent 最小改动完成，不动既有调用；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 上游 `page` 非法值被钳制而非报错——服务端按契约先行 400，不透传钳制（步骤 2.2，测试锁定）；
  - 关键词含正则元字符——`indexOf` 切分天然规避（步骤 3.2，单测锁定）；
  - 快速输入竞态乱序覆盖——AbortController 取消 + effect 清理（步骤 3.3，单测锁定）；
  - PRD「沿用看板的时间格式」无现成实现（看板不渲染事件时间）——本期新增 `formatOccurredAt` 并在 spec 记录，属口径补全而非需求变更（步骤 3.2）；
  - e2e stub 未 mock 分支返 404——`/api/live-events/search` 分支必须加入既有 handler，否则新页面用例全挂（步骤 5）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-20-danmaku-search-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-20-danmaku-search-proposal.md]]（v1.0）
- 契约：`contract/live-events.openapi.yaml`
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 最近邻实现方案参考：[[2026-08-19-danmaku-board-visual-polish-impl-plan.md]]
