---
description: 周表二期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（生成周表图片弹层：ISO 周切换、Canvas 纯前端绘制、长按/右键保存；日历历史直播混合展示：服务端代理 + Redis 缓存 + 静默降级；分支策略、契约先行、并行实现、TDD 步骤、验证与验收）
type: Permanent
---

# 周表二期（周表图片生成 + 历史直播混合展示） 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-15-weekly-schedule-v2-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-15-weekly-schedule-v2-proposal.md]]（v1.0）
**关联契约**: `contract/live-history.openapi.yaml`（本期新增）、`contract/stream-plans.openapi.yaml`（复用，不变）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/03-backdoor-design.md]]、[[../../design/04-weekly-schedule-design.md]]
**素材坐标**: `apps/bookstore/public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg`，1665×1080）
**需求总分支**: `prd/weekly-schedule-v2`
**开发分支**: `feat/weekly-schedule-v2`（自 `prd/weekly-schedule-v2` 切出）
**版本**: v1.0（2026-08-15）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**：一期 `feat/weekly-schedule` 已合入主线，`features/schedule/` 已具备 `CalendarView`（月视图，周一开头，公开站与后台共用）、`DayDetailDialog`（只读/管理双模式）、`PlanFormDialog`、`api.ts`（`listPlans` 公开读）；`servers/api` 具备公开读/受限写路由模式、ioredis 会话设施与 MongoDB；Aspire 编排含 Redis。本期为**纯增量**：新增一份契约、一条后端代理路由、一个前端 `weeklyImage/` 模块，并改造日历组件为双来源混合渲染。整体顺序：**契约新增 → 后端与前端并行增量（subagent）→ 服务编排 → API 集成测试 → e2e → 收尾验收**。全程遵循 TDD（先写失败测试再实现）；写代码前加载对应目录 AGENTS.md 与 `docs/engineering/backend-rules.md`（后端）/ `docs/engineering/frontend-rules.md`（前端）。

## 1. 现状与差距（一期现状 → 二期目标）

| 项 | 一期现状（主线已有） | 二期目标（依据提案 v1.0） |
|----|---------------------|---------------------------|
| 契约 | `contract/` 仅 `backdoor-auth`、`stream-plans` 两份 | 新增 `contract/live-history.openapi.yaml`：`GET /api/live-history` 公开读，200 + `{ ok, records[] }`（记录仅 `title`/`startDate`/`stopDate`，≤100 条按 `startDate` 倒序），降级形态 200 + `{ ok: false, records: [] }` |
| 后端路由 | `routes/` 有 auth、users、streamPlans | 新增 `routes/liveHistory.ts`：公开读代理——Redis 缓存（key `live-history:latest`，TTL 300s）→ 未命中拉上游（5s 超时）→ 裁剪三字段、缺 `title`/`startDate` 丢弃、倒序取 100 条 → 写缓存返回；失败时 stale-if-error，否则降级体；`app.ts` 挂载 `api.use("/live-history", …)` |
| 后端配置 | `config.ts` 无上游地址项 | `config.ts` 增加 `liveHistoryUpstreamUrl`：`LIVE_HISTORY_UPSTREAM_URL` 环境变量，缺省为 PRD 给定内网地址；内网地址不进前端 bundle |
| Aspire 编排 | api 资源注入 Redis/MongoDB/会话种子 | `infra/aspire/apphost.cs` 为 api 注入 `LIVE_HISTORY_UPSTREAM_URL`（取编排环境变量，缺省 PRD 地址），便于测试环境指向 stub 上游 |
| 前端取数 | `features/schedule/api.ts`：`listPlans`/`createPlan`/`updatePlan`/`deletePlan` | 扩展：`LiveRecord` 类型与 `listLiveHistory()`；`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }` |
| 日历组件 | `CalendarView` 仅渲染人工计划（至多 2 条 + 「+N」） | 改造为统一条目模型 `CalendarEntry`（plan/history 双来源）：新增 `mergeEntries.ts` 纯函数归一化合并；历史条目「实录」点标记 + 墨色弱化、恒为已播出样式；两路数据独立加载，历史失败静默降级 |
| 当日安排弹层 | `DayDetailDialog` 仅列人工计划 | 改造：混合列出，历史行加「实际播出」小标签、只读（任何角色无编辑/删除入口）、附结束时刻 |
| 周表图片生成 | 不存在 | 新增 `features/schedule/weeklyImage/`：`weekUtils.ts`（ISO 周计算）、`layout.ts`（布局纯函数，注入 measure，shrink-to-fit + 截断「…」）、`renderer.ts`（底图/字体加载、Canvas 绘制、PNG dataURL）、`WeeklyImageDialog.tsx`（周切换器 + 预览 `<img>` + 保存提示）；后台「直播计划」页新增「生成周表图片」按钮 |
| 主页缎条 | `features/home/WeeklySchedule.tsx` 仅人工计划 | **不混入**历史记录（保持一期语义，提案 §6.1） |
| 测试 | 一期三层测试已存在 | 增量：周计算/布局/合并/弹层单测，`live-history` API 集成测试（stub 上游），生成弹层与混合日历 e2e |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/weekly-schedule-v2`；
- 实现工作在开发分支 `feat/weekly-schedule-v2` 上进行（自 `prd/weekly-schedule-v2` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/weekly-schedule-v2` 切出 `feat/weekly-schedule-v2`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/weekly-schedule-v2`；一期实现（`features/schedule/`、`routes/streamPlans.ts`）在位。

### 步骤 1：新增契约 `contract/live-history.openapi.yaml`

以提案 §3.1 为准新增契约（单一事实源，不动既有两份）：

1. `GET /api/live-history`：`security: []` 公开读，无参数；
2. 200 响应体 `{ ok: boolean, records: LiveRecord[] }`；`LiveRecord` 仅 `title`（string，必填）、`startDate`（string，必填）、`stopDate`（string，可选）三字段；`records` ≤100 条、按 `startDate` 倒序；
3. 明确降级形态亦为 200 + `{ ok: false, records: [] }`（上游不可达/超时/非法时的唯一失败表达，不用 5xx）；
4. 描述中注明：服务端代理内网上游并做字段裁剪与短 TTL 缓存，上游地址不出现在客户端可见位置。

**验证**：契约通过 YAML 解析；路径、字段、状态码与提案 §3.1 逐条一致。

### 步骤 2：后端增量（subagent A，TDD）

加载 `servers/api/AGENTS.md` 与 `docs/engineering/backend-rules.md`，以契约为准：

1. 先写单元测试（`servers/api/tests/liveHistory.test.ts`，Vitest）并确认变红：
   - 成功路径：缓存未命中 → 拉上游 → 仅透传 `title`/`startDate`/`stopDate` 三字段 → 按 `startDate` 倒序取前 100 条 → 写缓存（`EX 300`）→ `{ ok: true, records }`；
   - 缓存命中：不发上游请求直接返回缓存内容；
   - 裁剪：缺 `title` 或 `startDate` 的条目丢弃；上游返回非数组/非法 JSON 按失败处理；
   - 降级：上游超时/网络错误/非法响应 → 有过期缓存返回过期缓存（stale-if-error）→ 无缓存返回 `{ ok: false, records: [] }`（HTTP 200）；
2. 实现 `config.ts` 增量：`liveHistoryUpstreamUrl`（`LIVE_HISTORY_UPSTREAM_URL`，缺省 PRD 地址）；
3. 实现 `routes/liveHistory.ts`：仅 GET、公开读；上游 `fetch` 5s 超时（`AbortSignal.timeout`）；缓存依赖注入最小接口（`get`/`set`），单测用内存 stub，上游请求以 `vi.stubGlobal("fetch", …)` 或注入 fetch 打桩；
4. `app.ts` 挂载 `api.use("/live-history", createLiveHistoryRouter(…))`，Redis 客户端复用 `index.ts` 既有 ioredis 实例（经 deps 传入，不新建连接）；
5. 确认转绿。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端增量（subagent B，TDD，与步骤 2 并行）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/01-visual-identity.md`、`docs/design/03-backdoor-design.md`（后台部分）、`docs/design/04-weekly-schedule-design.md` 与素材坐标 `apps/bookstore/public/assets/original/AGENTS.md`。注意 `apps/bookstore/AGENTS.md` 的提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。

1. `weeklyImage/weekUtils.ts`（先写测试）：纯函数 `getISOWeek(date)`、`getWeekRange(year, week)`（`YYYY-MM-DD` 周一~周日）、`shiftWeek(year, week, delta)`、`formatWeekLabel(year, week)`（「2026 年第 33 周」）；自实现 ISO-8601 算法（1 月 4 日所在周为第 1 周），不引入日期库，风格对齐 `dateUtils.ts`；单测覆盖年末/年初跨界（如 2026-12-28 属 2027 年第 1 周）、跨年 shift；
2. `weeklyImage/layout.ts`（先写测试）：输入按计划（`date`+`startTime` 升序）与周一日期，输出 7 天绘制指令 `{ dayIndex, x, y, width, height, text, fontSize }[]`；坐标常量 `x=365`、`y=278/379/480/580/681/782/883`（周一至周日）、区域 715×70；同日多场以「 / 」连接单行；注入 `measure(text, fontSize) → number`，字号自基准约 40px shrink-to-fit 纳入 715 宽度，下限 22px，触底截断加「…」；单测用桩测量（按字符数近似）覆盖同日多场、缩档、截断、空周输出；
3. `weeklyImage/renderer.ts`：底图 `new Image()`（同源 public 资源）与 `document.fonts.load('600 40px "Noto Serif SC"')` 并行预加载，二者就绪后绘制——底图全幅铺底，逐日绘制 `HH:mm 主题`，文字色 `#342a40`（按素材底色微调对比度），垂直居中于每日区域；完成 `canvas.toDataURL('image/png')`；字体加载失败降级为已加载 serif 族并控制台告警；画布固定 1665×1080 内部分辨率；
4. `weeklyImage/WeeklyImageDialog.tsx`（先写测试）：Client Component 弹层——周切换器（左右箭头 + 「2026 年第 xx 周」标签，打开时默认今天所在周）、预览 `<img src={dataURL}>`（CSS 自适应弹层宽度）、下方小字「长按保存图片，或右键另存为」（`--text-tiny`、`--color-ink-dim`）；打开时一次性 `listPlans` 拉全量计划，切换周只重跑布局 + 重绘（不重发请求）；素材加载失败时弹层内提示 + 重试；视觉遵循 frontend-design 规范与 `03-backdoor-design.md`（仅 `@theme` token、无氛围动效、过渡 ≤200ms）；
5. `features/schedule/api.ts`（先改测试）：新增 `LiveRecord` 类型与 `listLiveHistory()`；`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }`；
6. `features/schedule/mergeEntries.ts`（先写测试）：纯函数 `mergeEntries(plans, records, now) → CalendarEntry[]`；历史记录 `startDate` 按访客本地时区折算 `date`/`startTime`，跨天归开播当日，缺字段丢弃；与计划同键混排（按 `date`+`startTime` 升序），同日同时两条都展示不去重；单测覆盖排序、跨天归日、缺字段丢弃、来源样式映射；
7. `CalendarView.tsx` 改造（先改测试）：数据源扩展为 `CalendarEntry[]`，历史条目以「实录」点标记 + `--color-ink-dim` 弱化区分，恒为已播出样式；计划与历史两路独立加载（计划失败沿用一期错误提示，历史失败静默不渲染历史条目）；
8. `DayDetailDialog.tsx` 改造（先改测试）：混合列出，历史行加「实际播出」小标签、只读（任何角色无编辑/删除入口）、附 `stopDate` 折算的结束时刻；
9. 后台页 `app/backdoor/(dashboard)/schedule/page.tsx` 编排（先改测试）：新增「生成周表图片」按钮打开 `WeeklyImageDialog`（member 亦可用，只读性质）；日历接入混合条目；
10. 公开页 `CalendarViewPage.tsx` / `app/(site)/calendar/page.tsx`：复用同一 `CalendarView` 自动获得混合展示能力；守卫分支（未配置即 `NotFoundPage`）保持不变；
11. 主页 `features/home/WeeklySchedule.tsx` **不改动**（不混入历史记录）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：服务编排（SKILL: z-aspire-orchestrator）

- `infra/aspire/apphost.cs`：api 资源增加 `.WithEnvironment("LIVE_HISTORY_UPSTREAM_URL", …)`——取编排进程环境变量 `LIVE_HISTORY_UPSTREAM_URL`，缺省为 PRD 给定内网地址；Redis/MongoDB 注入链复用既有；
- `aspire start` 后通过 `aspire describe` 注入集成测试端点；
- API 集成测试运行方式：先起本地 stub 上游（见步骤 5），以 `LIVE_HISTORY_UPSTREAM_URL=http://localhost:<stub-port>` 启动 Aspire，使 api 代理指向 stub。

**验证**：四资源 Running；`curl $API_BASE_URL/api/live-history` 在 stub 上游就绪时返回 `{ "ok": true, "records": [...] }`。

### 步骤 5：API 集成测试（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md` 与新契约，新增 `tests/api/src/live-history.test.ts`（只依据契约编写，禁止对照实现）：

- stub 上游：测试进程内起本机 HTTP stub，可控返回正常记录（>100 条、含缺字段条目）、非法 JSON、悬挂（超时）三种模式；
- 用例：200 且仅含 `title`/`startDate`/`stopDate` 三字段；条数 ≤100 且按 `startDate` 倒序；缺 `title`/`startDate` 条目被丢弃；上游超时降级 `ok: false` + 空数组（HTTP 200）；上游非法 JSON 降级；二次请求命中缓存（同一 stub 调用计数不变或响应一致佐证）；
- 缓存隔离：用例间清理 Redis key `live-history:latest`（经 `aspire describe` 取 Redis 端点直连清理），避免缓存串扰；
- 既有用例全量回归无回退。

**验证**：Aspire 编排下 `pnpm -C tests/api test` 全绿。

### 步骤 6：e2e（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`，复用现有工程（Aspire 编排，`BOOKSTORE_BASE_URL` 注入）：

1. 新增/改造 `tests/e2e/src/backdoor/schedule.spec.ts`：admin 登录 → 进入「直播计划」→ 点击「生成周表图片」→ 弹层出现周切换器（「20xx 年第 xx 周」标签）→ 左右切换标签变化 → 预览 `<img>` 存在且 `src` 为 PNG dataURL → 保存提示小字可见；日历同日出现计划与历史记录（来源样式可辨）；历史记录在当日弹层中无编辑/删除入口；member 视角：「生成周表图片」可用，历史记录只读；
2. 历史记录与降级：用 Playwright `page.route` 拦截 `**/api/live-history`——正常体（含与人工计划同日记录）断言混合渲染与来源区分；降级体 `{ ok: false, records: [] }` 断言日历正常仅显示计划、无错误提示；无需改动 Aspire 编排；
3. 改造 `tests/e2e/src/bookstore/calendar.spec.ts`：公开站 `/calendar` 同样混合展示（历史记录只读），访客无需登录；
4. 未配置形态用例（`unconfigured.spec.ts`）保持：主页无入口、`/calendar` 404、不发 `/api/*` 请求、「生成周表图片」入口不出现；
5. 回归既有 e2e 全量用例，确认无回退。

**验证**：已配置与未配置两种构建形态下 e2e 分别全绿。

### 步骤 7：收尾与验收

1. 更新 `apps/bookstore/AGENTS.md`（`weeklyImage/` 模块与混合日历约定）、`servers/api/AGENTS.md`（`/api/live-history` 代理口径与配置项）、根 `AGENTS.md`（`contract/` 新增 `live-history.openapi.yaml`）；`tests/api`/`tests/e2e` AGENTS.md 如目录结构变化同步更新；
2. 核对提案 §10 验收标准与 PRD 功能点 1/2 验收标准逐条通过；
3. 推送 `feat/weekly-schedule-v2` 并提 PR 至 `prd/weekly-schedule-v2`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：一期 `features/schedule/` 组件与 `GET /api/stream-plans` 已上线；素材 `weekly-schedules-raw.jpg` 及坐标标注在位且随站点同源分发（跨域 CDN 会污染画布导致 `toDataURL` 抛错，本期无此问题，文档中标注约束）；Redis 为 Aspire 既有资源；内网上游需部署环境可达；
- **并行协调**：步骤 2 与步骤 3 由不同 subagent 并行，二者只读契约、互不修改对方目录；步骤 1 契约先行为对齐点；无共享文件写冲突；
- **风险**：
  - ISO 周与民间「周数」口径差异——以 ISO-8601 为准（与日历周一开头、官方周表 MON–SUN 一致），单测锚定年末/年初跨界（步骤 3.1）；
  - 超小字号可读性——字号下限 22px，低于下限即截断「…」（步骤 3.2）；
  - 字体未就绪出成品缺字图——`document.fonts.load` 就绪后才绘制，失败降级 serif 族并告警（步骤 3.3）；
  - 上游不可达是常态风险（内网拓扑依赖部署环境）——服务端降级体 + stale-if-error 与前端静默降级双保险（步骤 2、5、6）；
  - 上游时间戳时区——按访客本地时区折算，实现时用真实上游样本校准（步骤 3.6）；
  - 缓存串扰测试——`live-history:latest` 用例间清理（步骤 5）；
  - 内网地址泄露——上游地址仅存在服务端配置，不进前端 bundle、不进公开仓库客户端可见位置（步骤 1、2、4）；
  - 守卫为构建期生效——两种形态须分别构建验证（步骤 6 覆盖）；
  - 历史记录与计划同日同时——两条都展示不去重（PRD 明确），来源样式区分（步骤 3.6、3.8）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-15-weekly-schedule-v2-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-15-weekly-schedule-v2-proposal.md]]（v1.0）
- 一期文档：[[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]、[[../proposals/2026-08-13-weekly-schedule-proposal.md]]、[[2026-08-13-weekly-schedule-impl-plan]]
- 视觉识别：[[../../design/01-visual-identity.md]]；后台设计：[[../../design/03-backdoor-design.md]]；周表设计：[[../../design/04-weekly-schedule-design.md]]
- 素材坐标说明：`apps/bookstore/public/assets/original/AGENTS.md`
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
