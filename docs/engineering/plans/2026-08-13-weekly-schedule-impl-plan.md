---
description: 周表实现方案——基于 PRD v1.0 与技术提案 v1.0 的实施计划（分支策略、契约先行、并行实现、TDD 步骤、验证与验收）
type: Permanent
---

# 周表（直播日程） 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-13-weekly-schedule-proposal.md]]（v1.0）
**关联契约**: `contract/stream-plans.openapi.yaml`（本期新增）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]、[[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/weekly-schedule`（需求总 PR：<https://github.com/Deliay/sumire/pull/8>）
**开发分支**: `feat/weekly-schedule`（自 `prd/weekly-schedule` 切出）
**创建日期**: 2026-08-13
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。范围横跨契约、后端（`servers/api`）、前端（`apps/bookstore`）与两层集成测试（`tests/api`、`tests/e2e`）。整体顺序：**契约先行 → 后端与前端并行实现（subagent）→ 服务编排 → API 集成测试 → e2e 测试 → 收尾验收**。全程遵循 TDD（先写失败测试再实现）；写代码前加载对应目录 AGENTS.md 与 `docs/engineering/backend-rules.md`（后端）/ `docs/engineering/frontend-rules.md`（前端）。

## 1. 现状与差距

| 项 | 现状 | 目标（依据提案） |
|----|------|----------------|
| 契约 | 仅 `contract/backdoor-auth.openapi.yaml`（鉴权域） | 新增 `contract/stream-plans.openapi.yaml`，定义 `GET /api/stream-plans`（公开读）与 `POST /api/stream-plans`（受限写），单一事实源 |
| 后端持久化 | `servers/api/src/db/` 仅 `users.ts` | 新增 `db/streamPlans.ts`：mongoose 模型（`date` 字符串 + 索引、`title` 1–50 字符、`createdBy`、`createdAt`），导出 `listStreamPlans` / `createStreamPlan` / `findStreamPlan` |
| 后端路由 | `routes/` 仅 `auth.ts`、`users.ts` | 新增 `routes/streamPlans.ts` 并挂载到 `app.ts` 的 `api` 路由器；GET 公开，POST 走会话 + `requireRole("admin")` 层级判定（admin 及以上可写）；400/401/403/409 语义按契约 |
| 前端 API 封装 | `features/backdoor/api.ts` 导出 `API_BASE_URL` / `API_CONFIGURED` | 新增 `features/schedule/api.ts`：复用同一基址与 `API_CONFIGURED` 口径，封装 `listPlans(from, to)` 与 `createPlan(date, title)` |
| 日历视图组件 | 不存在 | 新增 `features/schedule/CalendarView.tsx`：自实现月网格（周一开头），客户端组件，props 接收 `plans` 与 `onMonthChange(from, to)`；已播出弱化、待播出高亮、今天描边；同日多场全部展示 |
| 公开站日历页 | 不存在 | 新增 `app/(site)/calendar/page.tsx`：未配置基址即渲染站点风格 404（复用 `components/NotFoundPage` 口径，不加载日历、不发请求）；已配置时渲染 `CalendarView` |
| 后台「直播计划」模块 | 不存在 | 新增 `app/backdoor/(dashboard)/schedule/page.tsx`：`CalendarView` + 「增加直播计划」按钮 + `features/schedule/CreatePlanDialog.tsx`（参照 `CreateUserDialog` 模式）；`SideNav.tsx` 增加导航项（superadmin/admin/member 可见，member 不渲染按钮） |
| 主页入口区块 | `features/home/` 仅 `ColorChip.tsx`、`EntryCard.tsx` | 新增 `features/home/WeeklySchedule.tsx`：本周条列（MON–SUN）氛围区块，藤蔓/蕾丝/应援色 `#b4a6bf`，底部「查看完整日历 →」链接 `/calendar`；仅 `API_CONFIGURED` 时由 `app/(site)/page.tsx` 挂载 |
| 测试 | `tests/api/`、`tests/e2e/` 仅有鉴权与站点用例 | 新增 stream-plans API 集成测试、后台录入/公开查看/未配置形态 e2e；前端与后端各自补齐单元测试 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/weekly-schedule`，需求总 PR #8 随提交更新；
- 实现工作在开发分支 `feat/weekly-schedule`（自 `prd/weekly-schedule` 切出）上进行，完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支

- 自 `prd/weekly-schedule` 切出 `feat/weekly-schedule` 并推送远端。

**验证**：`git status` 干净，位于 `feat/weekly-schedule`。

### 步骤 1：契约先行 `contract/stream-plans.openapi.yaml`

按提案 §3.1 编写契约，作为后续所有实现的单一事实源：

1. `GET /api/stream-plans`：query `from`/`to`（`YYYY-MM-DD`，可选），200 返回 `{ plans: [{ id, date, title, createdAt }] }`（按日期升序），400 日期格式非法；无需登录（`security: []`）；
2. `POST /api/stream-plans`：body `{ date, title }`，201 返回 `{ ok, id, date, title }`；400（日期非法 / 主题为空或超 50 字符）、401（未登录）、403（角色不足）、409（同日同主题重复）；错误体统一 `{ error: string }`，中文文案（与 `servers/api` 既有约定一致）；
3. 契约中明确 `date` 为 `YYYY-MM-DD` 字符串、`title` trim 后 1–50 字符。

**验证**：契约文件通过 YAML 解析；接口路径、状态码、字段与提案 §3.1 逐条一致。

### 步骤 2：后端实现（subagent A，TDD）

加载 `servers/api/AGENTS.md` 与 `docs/engineering/backend-rules.md`，以契约为准：

1. 先写单元测试（`servers/api/tests/`，Vitest）：
   - `db/streamPlans.ts`：`createStreamPlan` 写入与返回形状、`listStreamPlans(from, to)` 区间过滤与升序、`findStreamPlan(date, title)` 判重命中；
   - `routes/streamPlans.ts`：POST 的 400（日期格式非法 / 非真实日期如 `2026-02-30` / 主题空 / 主题超 50 字符）、401（无会话）、403（member）、409（同日同主题）、201 成功；GET 的区间过滤与 400；
   - 确认测试变红；
2. 实现 `db/streamPlans.ts`：mongoose schema（`date` 字符串建索引，`title` trim 后 1–50 字符服务端校验，`createdBy` 取会话用户名，`createdAt` 默认 `Date.now`），风格对齐 `db/users.ts`（`lean()` 查询、显式类型）；
3. 实现 `routes/streamPlans.ts`：GET 公开不校验会话，`from`/`to` 经显式正则校验后走 `$gte`/`$lte`（拒绝任意对象注入）；POST 复用 `req.user` + `requireRole("admin")`（层级判定，admin 及以上可写，member 403），先 `findStreamPlan` 判重（409）再写入；`app.ts` 挂载 `api.use("/stream-plans", …)`；
4. 确认转绿。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端实现（subagent B，TDD，与步骤 2 并行）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/01-visual-identity.md`、`docs/design/02-page-design.md` 与 `docs/design/03-backdoor-design.md`（后台部分）。注意 `apps/bookstore/AGENTS.md` 的提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。

1. `features/schedule/api.ts`（先测试）：`listPlans(from, to)`、`createPlan(date, title)`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL` / `API_CONFIGURED`；未配置时不发请求（短路口径一致）；
2. `CalendarView.tsx`（先测试）：自实现月网格（周一开头，MON–SUN），纯 `YYYY-MM-DD` 字符串比较规避时区；props `plans` + `onMonthChange(from, to)`；有计划日期展示主题（同日多场全展示）、过去弱化 / 未来高亮 / 今天描边、当日无计划空态。单测覆盖：边界月份（12→1、1→12 翻月）、闰年 2 月、月初/月末补位格、已播出/待播出/今天的样式区分；
3. `CreatePlanDialog.tsx`（先测试）：参照 `CreateUserDialog` 模式；日期 `<input type="date">` + 主题 `TextField`；日期或主题为空禁止提交并提示；提交成功回调父组件本地追加计划（日历即时反映，不整页刷新）；409 时展示「该日已有相同主题的计划」；
4. 后台页 `app/backdoor/(dashboard)/schedule/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；`SideNav.tsx` 增加 `{ href: "/backdoor/schedule", label: "直播计划", roles: ["superadmin", "admin", "member"] }`；「增加直播计划」按钮（`PrimaryButton`）仅 superadmin/admin 渲染（member 只读，与后端 403 口径一致，单测覆盖三种角色）；
5. 公开日历页 `app/(site)/calendar/page.tsx`：未配置基址直接渲染 `NotFoundPage`（对齐 `app/backdoor/layout.tsx` 的守卫口径，不加载日历 chunk、不发请求）；已配置时渲染 `CalendarView` 并按当前月区间取数；守卫分支单测覆盖；
6. 主页区块 `features/home/WeeklySchedule.tsx`：客户端组件，拉取本周区间（周一~周日）数据按 MON–SUN 条列（有计划展示主题、无计划空态），藤蔓角饰/蕾丝边框/应援色 `#b4a6bf`（仅用 `@theme` token 色，参照 `docs/design/references/promo-weekly-schedule.png` 氛围），底部「查看完整日历 →」链接 `/calendar`；初始渲染为固定最小高度加载骨架，避免 hydration 布局跳动；`app/(site)/page.tsx` 仅在 `API_CONFIGURED` 时挂载（未配置不留占位，单测覆盖）。

视觉遵循 frontend-design 规范，主页区块不允许是裸组件堆砌。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：服务编排（SKILL: z-aspire-orchestrator）

- `infra/aspire` 编排 bookstore + api + Redis + MongoDB 四资源（复用现有 AppHost，无需新增资源；`stream_plans` 集合由 mongoose 自动创建）；
- `aspire start` 后通过 `aspire describe` 注入集成测试端点。

**验证**：四资源 Running；`curl $API_BASE_URL/api/stream-plans` 返回 200 `{ "plans": [] }`（公开读无需登录）。

### 步骤 5：API 集成测试（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md`（如存在）与契约文件，新增 `tests/api/src/stream-plans.test.ts`（Vitest + fetch + Cookie jar，风格对齐 `users.test.ts`）：

- `GET /api/stream-plans`：空库返回空数组；区间过滤（`from`/`to` 边界含端点）；非法日期参数 400；无需登录可访问；
- `POST /api/stream-plans`：未登录 401；member 登录 403；admin/superadmin 201；日期非法 / 主题空 / 主题超 50 字符 400；同日同主题 409、同日不同主题 201（一天多场）；写入后 GET 可读且按日期升序（持久化验证）。

**验证**：Aspire 编排下 `pnpm -C tests/api test` 全绿，且既有用例无回退。

### 步骤 6：e2e 测试（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`（如存在），复用现有工程（Aspire 编排，`BOOKSTORE_BASE_URL` 注入）：

1. 新增 `tests/e2e/src/backdoor/schedule.spec.ts`：admin 登录 → 侧边导航进入「直播计划」→ 点击「增加直播计划」录入日期+主题 → 对话框关闭后日历即时可见新计划 → 翻月查看历史/未来计划；member 登录视角：可见日历与导航项，但无「增加直播计划」按钮；
2. 新增 `tests/e2e/src/bookstore/calendar.spec.ts`：主页出现「本周日程」入口区块 → 点击进入 `/calendar` → 日历展示后台录入的计划（已播出/待播出可区分）；访客无需登录；
3. 扩展未配置形态用例（沿用 `unconfigured.spec.ts` 的 `BOOKSTORE_STATIC_BASE_URL` 模式）：未配置构建下主页无周表入口、`/calendar` 呈现 404 且不发往主站自身的 `/api/*` 请求；
4. 回归既有 e2e 全量用例，确认无回退。

**验证**：已配置与未配置两种构建形态下 e2e 分别全绿。

### 步骤 7：收尾与验收

1. 更新 `apps/bookstore/AGENTS.md`（新增 `features/schedule/` 与 `/calendar`、`/backdoor/schedule` 约定）、`servers/api/AGENTS.md`（新增 `stream-plans` 路由与集合说明）、根 `AGENTS.md`（`contract/` 条目补充新契约文件）；若实施与提案出现偏差，同步更新提案并记录；
2. 核对提案 §10 验收标准与 PRD 功能点 1/2/3 验收标准逐条通过；
3. 推送 `feat/weekly-schedule` 并提 PR 至 `prd/weekly-schedule`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：本地 Aspire 编排可用（步骤 4–6 依赖其注入端点与 MongoDB）；`servers/api` 既有会话 / RBAC / mongoose 设施已上线；`features/backdoor/api.ts` 的 `API_CONFIGURED` 单一事实源（login-optimization 已落地）；
- **并行协调**：步骤 2 与步骤 3 由不同 subagent 并行，二者只读契约、互不修改对方目录；`app.ts` 与 `SideNav.tsx` 等共享文件各归其侧，无写冲突；
- **风险**：
  - 守卫为构建期生效——同一构建产物无法运行时切换形态，两种形态须分别构建验证（步骤 6 覆盖）；
  - 月网格跨月/闰年边界易错——单测覆盖边界月份（步骤 3），不引入日历库（提案决策已定）；
  - 前后端角色口径漂移（member 只读）——后端 403 为准，前端按钮隐藏仅为体验，e2e 覆盖 member 视角（步骤 6）；
  - 公开读接口注入面——查询参数显式字符串校验后再进 mongoose（步骤 2），API 测试覆盖非法参数（步骤 5）；
  - 主页 SSG + 客户端取数的 hydration 边界——骨架固定最小高度（步骤 3），e2e 断言无布局跳动导致的入口不可点。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]
- 技术提案：[[../proposals/2026-08-13-weekly-schedule-proposal.md]]
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 视觉识别：[[../../design/01-visual-identity.md]]；页面设计：[[../../design/02-page-design.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 官方周表参考图：`docs/design/references/promo-weekly-schedule.png`
- 既有实现方案：[[2026-08-12-backdoor-auth-impl-plan]]、[[2026-08-13-login-optimization-impl-plan]]
