---
description: 周表实现方案 v1.1——基于 PRD v1.1 与技术提案 v1.1 的增量实施计划（开始时间、编辑/删除、当日安排弹层、定制日期/时间选择器；分支策略、契约先行、并行实现、TDD 步骤、验证与验收）
type: Permanent
---

# 周表（直播日程） 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]（v1.1）
**关联技术提案**: [[../proposals/2026-08-13-weekly-schedule-proposal.md]]（v1.1）
**关联契约**: `contract/stream-plans.openapi.yaml`（本期升级）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]、[[../../design/03-backdoor-design.md]]、[[../../design/04-weekly-schedule-design.md]]
**需求总分支**: `prd/weekly-schedule`（需求总 PR：<https://github.com/Deliay/sumire/pull/8>）
**开发分支**: `feat/weekly-schedule`（自 `prd/weekly-schedule` 切出）
**版本**: v1.1（2026-08-13，评审返工后重做）
**作者**: sumire workflow

> 修订记录：v1.1——PRD/提案/设计升级后重做本方案。相对 v1.0 的变化：直播计划新增 `startTime`（结束时间 TBD 不做）；编辑（PUT）/删除（DELETE）纳入本期；后台新增「当日详细安排」弹层（查看/增加预填日期/编辑/删除）；日期/时间输入改为定制 DatePicker/TimePicker；界面按设计文档 `04-weekly-schedule-design.md` 的「大气」基调实现。

本方案将技术提案 v1.1 落实为可执行的实施计划。**前提事实**：`feat/weekly-schedule` 已含 v1.0 全量实现（契约 GET/POST、后端 db/routes、前端日历组件/后台模块/公开日历页/主页入口、三层测试），本方案为 **v1.0 → v1.1 的增量升级计划**，在既有实现上改造而非从零重写。整体顺序：**契约升级 → 后端与前端并行增量（subagent）→ 服务编排 → API 集成测试增量 → e2e 增量 → 收尾验收**。全程遵循 TDD（先改/写失败测试再实现）；写代码前加载对应目录 AGENTS.md 与 `docs/engineering/backend-rules.md`（后端）/ `docs/engineering/frontend-rules.md`（前端）。

## 1. 现状与差距（v1.0 实现 → v1.1 目标）

| 项 | v1.0 现状（feat 分支已有） | v1.1 目标（依据提案 v1.1） |
|----|--------------------------|---------------------------|
| 契约 | `contract/stream-plans.openapi.yaml` 仅 GET（公开）/ POST（受限），字段 `date` + `title`，判重 `(date, title)` | 升级：`StreamPlan` 增加 `startTime`（`HH:mm`，必填）；新增 `PUT /api/stream-plans/{id}` 与 `DELETE /api/stream-plans/{id}`；判重键改 `(date, startTime, title)`（编辑排除自身）；`{id}` 非法 ObjectId 返回 400、不存在 404 |
| 后端持久化 | `db/streamPlans.ts`：`date`（索引）/`title`/`createdBy`/`createdAt`，导出 `listStreamPlans` / `createStreamPlan` / `findStreamPlan`，排序 `date + _id` | 增量：schema 增加 `startTime`（必填）与 `updatedAt`；排序改 `date + startTime`；`findStreamPlan(date, startTime, title, excludeId?)`；新增 `updateStreamPlan(id, …)` / `deleteStreamPlan(id)` |
| 后端路由 | `routes/streamPlans.ts`：GET 公开；POST `requireRole("admin")` + 日期/主题校验 + 409 | 增量：新增 `isValidTime`（`HH:mm` 真实时间）；POST 增加 `startTime` 校验；新增 PUT（三字段均可改，改日期即改期，404/409 排除自身）与 DELETE（404）；`:id` 先校验 ObjectId 形态（400） |
| 前端 API 封装 | `features/schedule/api.ts`：`listPlans(from, to)` / `createPlan(date, title)` | 增量：`StreamPlan` 类型加 `startTime`；`createPlan(date, startTime, title)`；新增 `updatePlan(id, …)` / `deletePlan(id)` |
| 日历视图组件 | `CalendarView.tsx`：月网格（周一开头）、翻月回调、已播出/待播出/今天三态 | 改造：格子内摘要改 `HH:mm 主题`（至多 2 条，更多「+N」）；新增 `onSelectDay(date)` 点击回调；视觉按设计文档 §2.3（今天小花点睛、待播出 `--color-eye` 圆点、已播出 60% 透明、hover 蕾丝边框） |
| 当日安排弹层 | 不存在 | 新增 `DayDetailDialog.tsx`：只读/管理双模式（`readOnly` prop）。只读：纸面浮层、时间升序列表、空态文案；管理：深色浮层、行内「编辑」/「删除」（行内二次确认，不叠弹层）、底部「+ 增加计划」（日期预填所选日）。公开站永不渲染管理操作；member 角色降级只读 |
| 录入表单 | `CreatePlanDialog.tsx`：原生 `<input type="date">` + 主题 | 替换为 `PlanFormDialog.tsx`：录入/编辑双态同一组件（编辑态预填现值、标题切换）；三字段日期/开始时间/主题均必填；改用定制 DatePicker/TimePicker；409 提示文案更新为同日同时间同主题口径 |
| 日期/时间选择控件 | 原生控件 | 新增 `DatePicker.tsx`（只读输入 + 迷你月历浮层，复用月网格纯函数，支持键入 `YYYY-MM-DD` 解析回退）与 `TimePicker.tsx`（只读输入 + 时/分双列滚轮，分钟 15 步进，快捷项 `08:00/13:00/16:00/20:00/22:00`，支持键入 `HH:mm` 容错如 `9:5`→`09:05`）；共用浮层机制（点击外部/Esc 收起、焦点管理）；不使用原生默认样式 |
| 公开站日历页 | `app/(site)/calendar/page.tsx`：守卫 + `CalendarView`（经 `CalendarViewPage`） | 增量：接入 `onSelectDay` → 只读 `DayDetailDialog`；页眉/月份大名/切换条按设计文档 §2.1/2.2（80rem 宽容器、展示级月份字号、「回到本月」按钮） |
| 后台「直播计划」页 | `app/backdoor/(dashboard)/schedule/page.tsx`：日历 + 「增加直播计划」按钮 + `CreatePlanDialog` | 改造：按钮打开 `PlanFormDialog`（录入态）；点击某天打开管理态 `DayDetailDialog`；弹层内增加（日期预填）/编辑（可改期）/删除（二次确认）；变更后刷新当前月区间并同步弹层列表；改期出当前日时提示「已移至 X 月 X 日」；member 只读（不渲染任何管理入口） |
| 主页入口区块 | `features/home/WeeklySchedule.tsx`：MON–SUN 条列 + 主题 | 增量：条列加 `HH:mm` 前缀（缎带式，参照官方宣传图，设计文档 §3） |
| 月网格纯函数 | `features/schedule/dateUtils.ts`（含 `monthGrid`） | 复用：`DatePicker` 迷你月历直接复用 `dateUtils.ts` 的 `monthGrid` 等纯函数；**不另建 `monthGrid.ts`**——与提案 §7 命名差异在收尾步骤同步提案记录，避免无收益的重命名 churn |
| 测试 | v1.0 三层测试均已存在 | 增量：各层按 §3 补充 startTime / PUT / DELETE / 弹层 / 选择器用例，既有用例同步适配新字段 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/weekly-schedule`，需求总 PR #8 随提交更新；
- 实现工作在开发分支 `feat/weekly-schedule` 上进行（已含 v1.0 实现与 v1.1 文档），动手前先自 `prd/weekly-schedule` merge 最新文档基线；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：同步开发分支基线

- 在 `feat/weekly-schedule` 上 merge `prd/weekly-schedule`（带入 v1.1 文档与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/weekly-schedule`；PRD/提案/设计文档均为 v1.1。

### 步骤 1：契约升级 `contract/stream-plans.openapi.yaml`

以提案 §3.1 为准升级既有契约（单一事实源）：

1. `StreamPlan` schema 增加 `startTime`（`HH:mm`，pattern `^([01]\d|2[0-3]):[0-5]\d$`）与 `updatedAt`；`title` trim 后 1–50 字符不变；
2. `GET /api/stream-plans`：排序口径改为 `date + startTime` 升序，其余不变（公开读 `security: []`，400 日期格式非法）；
3. `POST /api/stream-plans`：body 增加 `startTime`（必填）；400 场景补充开始时间缺失/非法；409 语义改为「同日同时间同主题重复」；
4. 新增 `PUT /api/stream-plans/{id}`：三字段均可改（改日期即改期）；200 / 400（字段非法或 id 非 ObjectId）/ 401 / 403 / 404（计划不存在）/ 409（与他人计划重复，排除自身）；
5. 新增 `DELETE /api/stream-plans/{id}`：200 `{ ok: true }` / 400（id 非 ObjectId）/ 401 / 403 / 404；
6. 错误体统一 `{ error: string }`，中文文案（与 `servers/api` 既有约定一致）。

**验证**：契约通过 YAML 解析；路径、状态码、字段与提案 §3.1 逐条一致。

### 步骤 2：后端增量（subagent A，TDD）

加载 `servers/api/AGENTS.md` 与 `docs/engineering/backend-rules.md`，以契约为准：

1. 先改/写单元测试（`servers/api/tests/streamPlans.test.ts`，Vitest）并确认变红：
   - 既有用例适配：`createStreamPlan`/`listStreamPlans`/`findStreamPlan` 全部带 `startTime`；POST 201 用例补 `startTime`；
   - 新增：`isValidTime`（`HH:mm` 合法、`24:00`/`12:60`/缺位非法）；POST 缺 `startTime` 或非法 400；排序 `date + startTime`（同日多场按时间升序）；`findStreamPlan` 三键判重与 `excludeId` 排除自身；PUT 200（改期/改时间/改主题）、404、409（撞他人计划）、撞自身原值不算重复；DELETE 200、404；`:id` 非 ObjectId 400；
2. 实现 `db/streamPlans.ts` 增量：schema 加 `startTime: { type: String, required: true }` 与 `updatedAt: { type: Date }`；`toOutput` 透出 `startTime`；排序改 `{ date: 1, startTime: 1 }`；`findStreamPlan(date, startTime, title, excludeId?)`（`excludeId` 时加 `_id: { $ne }`）；新增 `updateStreamPlan`（写入 `updatedAt`）、`deleteStreamPlan`，风格对齐 `db/users.ts`（`lean()`、显式类型）；
3. 实现 `routes/streamPlans.ts` 增量：`isValidTime`（正则 + 真实时间判定）；POST 增加 `startTime` 校验（先于判重）；新增 `PUT /:id` 与 `DELETE /:id`（均 `requireRole("admin")`，`:id` 先过 ObjectId 形态校验否则 400；PUT 校验三字段 → 查存在性 404 → 判重排除自身 409 → 更新；DELETE 查存在性 404 → 删除）；
4. 确认转绿。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端增量（subagent B，TDD，与步骤 2 并行）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/01-visual-identity.md`、`docs/design/02-page-design.md`、`docs/design/03-backdoor-design.md`（后台部分）与 `docs/design/04-weekly-schedule-design.md`（本功能界面以它为准）。注意 `apps/bookstore/AGENTS.md` 的提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。

1. `features/schedule/api.ts`（先改测试）：`StreamPlan` 加 `startTime`；`createPlan(date, startTime, title)`；新增 `updatePlan(id, { date, startTime, title })`、`deletePlan(id)`；未配置短路口径不变；
2. `CalendarView.tsx` 改造（先改测试）：摘要渲染 `HH:mm 主题`、至多 2 条 + 「+N」；新增 `onSelectDay?(date)` prop 并在格子点击时上抛；三态视觉按设计 §2.3 校准（今天小花、待播出 `--color-eye` 圆点、已播出 60%、hover 蕾丝边框）；既有边界月份/闰年单测保持，新增摘要截断与点击回调用例；
3. 新增 `DayDetailDialog.tsx`（先写测试）：`readOnly` prop 双模式；列表按 `startTime` 升序、空态文案「这一天书屋静悄悄的。」；管理态行内「编辑」/「删除」（行内展开二次确认「确认删除 HH:mm 主题？」+ 确认/取消）、底部「+ 增加计划」回调；遮罩点击 / Esc / 右上角关闭；单测覆盖双模式渲染、排序、空态、删除确认流转；
4. 新增 `DatePicker.tsx` / `TimePicker.tsx`（先写测试）：只读输入 + 浮层（迷你月历复用 `dateUtils.ts` 的 `monthGrid`；双列滚轮 + 快捷时段）；支持键入解析与非法回退（`9:5`→`09:05`、`2026-13-01` 回退并提示）；共用浮层机制（点击外部 / Esc 收起、焦点管理）；单测覆盖解析容错、快捷项、键盘收起；
5. `PlanFormDialog.tsx` 替换 `CreatePlanDialog.tsx`（先改测试）：录入/编辑双态（`mode` 或 `initial` prop，编辑态预填、标题「编辑直播计划」）；三字段必填校验行内提示；提交成功后由父组件刷新数据；409 提示「该日该时间已有相同主题的直播计划」；删除旧 `CreatePlanDialog.tsx` 及其测试；
6. 后台页 `app/backdoor/(dashboard)/schedule/page.tsx` 编排（先改测试）：`selectedDay` / `editingPlan` / `formOpen` 状态机；点击某天 → 管理态 `DayDetailDialog`（member 只读）；弹层内增加（`date` 预填所选日）/编辑/删除后重拉当前月区间并同步弹层列表；编辑改期出当前日时弹层移除该条并提示「已移至 X 月 X 日」；单测覆盖状态流转与 member 降级；
7. 公开页 `app/(site)/calendar/page.tsx` / `CalendarViewPage.tsx`：接入只读 `DayDetailDialog`；页眉与月份切换条按设计 §2.1/2.2（容器 80rem、展示级月份大名、「回到本月」仅非当前月出现）；守卫分支（未配置即 `NotFoundPage`）保持不变；
8. 主页 `features/home/WeeklySchedule.tsx`：缎条改 `MON. + HH:mm 主题`；加载骨架与 `API_CONFIGURED` 挂载口径不变；
9. `SideNav.tsx` 导航项不变（superadmin/admin/member 均可见，member 页面内只读）。

视觉遵循 frontend-design 规范，弹层与控件不得是裸组件堆砌。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：服务编排（SKILL: z-aspire-orchestrator）

- `infra/aspire` 编排 bookstore + api + Redis + MongoDB 四资源（复用现有 AppHost，无需新增资源）；
- `aspire start` 后通过 `aspire describe` 注入集成测试端点；
- 注意：v1.0 已录入的 `stream_plans` 文档缺 `startTime`——本地/测试库直接清空集合重建（`db.stream_plans.deleteMany({})`），不做迁移脚本（数据未上线，无生产负担）。

**验证**：四资源 Running；`curl $API_BASE_URL/api/stream-plans` 返回 200 `{ "plans": [] }`。

### 步骤 5：API 集成测试增量（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md`（如存在）与契约文件，改造 `tests/api/src/stream-plans.test.ts`：

- 既有用例适配：POST 201 带 `startTime`；排序断言改 `date + startTime`（同日多场按时间升序）；
- 新增：POST 缺/非法 `startTime` 400；`PUT /api/stream-plans/:id`（200 改期/改时间/改主题、未登录 401、member 403、不存在 404、非法 id 400、撞他人计划 409、保持自身原值 200）；`DELETE /api/stream-plans/:id`（200、401、403、404、非法 id 400）；写后 GET 可读验证持久化与改期后区间归属。

**验证**：Aspire 编排下 `pnpm -C tests/api test` 全绿，且既有用例无回退。

### 步骤 6：e2e 增量（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`（如存在），复用现有工程（Aspire 编排，`BOOKSTORE_BASE_URL` 注入）：

1. 改造 `tests/e2e/src/backdoor/schedule.spec.ts`：admin 登录 → 进入「直播计划」→ 点击某天弹出当日详细安排弹层 → 弹层内「增加计划」（断言日期预填所选日）→ 保存后日历与弹层即时可见 → 编辑该条改期到另一天（断言原日消失、新日期出现）→ 删除（二次确认）→ 断言移除；member 登录视角：可见日历与当日弹层，无增加/编辑/删除入口；
2. 改造 `tests/e2e/src/bookstore/calendar.spec.ts`：主页缎条含开播时间 → 进入 `/calendar` → 点击有计划的一天 → 只读弹层展示当日安排（无管理操作）；访客无需登录；
3. 未配置形态用例（`unconfigured.spec.ts`）保持：主页无入口、`/calendar` 404、不发 `/api/*` 请求；
4. 回归既有 e2e 全量用例，确认无回退。

**验证**：已配置与未配置两种构建形态下 e2e 分别全绿。

### 步骤 7：收尾与验收

1. 更新 `apps/bookstore/AGENTS.md`（`features/schedule/` 新组件与弹层/选择器约定）、`servers/api/AGENTS.md`（stream-plans CRUD 与字段说明）、根 `AGENTS.md`（如有结构变化）；将「`monthGrid.ts` 未单建、复用 `dateUtils.ts`」的偏差同步记录到技术提案 §7；
2. 核对提案 §10 验收标准与 PRD 功能点 1/2/3/4 验收标准逐条通过；
3. 推送 `feat/weekly-schedule` 并提 PR 至 `prd/weekly-schedule`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：本地 Aspire 编排可用（步骤 4–6 依赖其注入端点与 MongoDB）；`servers/api` 既有会话 / RBAC / mongoose 设施已上线；`features/backdoor/api.ts` 的 `API_CONFIGURED` 单一事实源；设计文档 `04-weekly-schedule-design.md` 已定稿；
- **并行协调**：步骤 2 与步骤 3 由不同 subagent 并行，二者只读契约、互不修改对方目录；无共享文件写冲突；
- **风险**：
  - v1.0 → v1.1 是破坏式契约变更（`startTime` 必填）——前后端与三层测试必须同一批切换，契约先行（步骤 1）作为对齐点；旧数据清库重建（步骤 4），不做迁移；
  - 守卫为构建期生效——两种形态须分别构建验证（步骤 6 覆盖）；
  - 编辑改期的弹层一致性（计划移出当前所选日）——按「移除该条 + 提示已移至 X 月 X 日」实现（步骤 3），e2e 覆盖（步骤 6）；
  - 前后端角色口径漂移（member 只读）——后端 403 为准，前端隐藏入口仅为体验，e2e 覆盖 member 视角；
  - 键入解析容错（`9:5`、非法日期回退）——单测覆盖（步骤 3），不引入口径外的第三方日期库；
  - 弹层层级复杂度——删除确认行内展开，不叠独立确认弹层（设计文档 §4.2）；
  - 主页 SSG + 客户端取数的 hydration 边界——骨架固定高度，e2e 断言入口可点。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]（v1.1）
- 技术提案：[[../proposals/2026-08-13-weekly-schedule-proposal.md]]（v1.1）
- 周表设计：[[../../design/04-weekly-schedule-design.md]]
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 视觉识别：[[../../design/01-visual-identity.md]]；页面设计：[[../../design/02-page-design.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 官方周表参考图：`docs/design/references/promo-weekly-schedule.png`
- 既有实现方案：[[2026-08-12-backdoor-auth-impl-plan]]、[[2026-08-13-login-optimization-impl-plan]]
