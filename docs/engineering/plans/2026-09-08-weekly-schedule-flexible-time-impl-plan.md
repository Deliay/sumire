---
description: 周表灵活时间日程实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/weekly-schedule-flexible-time，唯一开发分支 feat/weekly-schedule-flexible-time，契约 + 后端 + 前端全链路变更。契约先行（stream-plans.openapi.yaml 增 TimeType 枚举、startTime 条件必填、判重与排序口径）；servers/api 模型加 timeType（缺省 fixed 零迁移）、parseFields 组合校验、判重键扩为（date,timeType,startTime,title）、应用层统一排序；前端新增 features/schedule/timeType.ts 共享模块（TimeType/类型秩/comparePlans/formatPlanLabel）贯穿 PlanFormDialog 表单联动、{schedules} 渲染、日历/详情/首页展示；单测 + API 集成 + e2e 三层覆盖，spec 与 AGENTS.md 同 PR 同步。
type: Permanent
---

# 周表灵活时间日程实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-08-weekly-schedule-flexible-time-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-08-weekly-schedule-flexible-time-proposal.md]]（v1.0）
**需求总分支**: `prd/weekly-schedule-flexible-time`（需求总 PR：<https://github.com/Deliay/sumire/pull/121>）
**开发分支**: `feat/weekly-schedule-flexible-time`（自需求总分支切出，**唯一开发分支**，契约/实现/测试全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-08）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 z-coding 契约式开发流程：更新 Contract → 编写实现（TDD）→ 覆盖测试。全链路变更：契约 + 后端（模型/校验/判重/排序）+ 前端（表单/渲染/展示），存量数据零迁移。

**前提事实**（已在需求总分支 `prd/weekly-schedule-flexible-time` 核对代码现态，commit b39d77b）：

- 契约现状：`contract/stream-plans.openapi.yaml` v1.1.0——`StreamPlan` required 含 `startTime`（`:185-194`），POST/PUT 请求体 `required: [date, startTime, title]`（`:49`、`:98`），GET 排序口径描述「按 date + startTime 升序」（`:12`、`:26`），400/409 描述均只提三字段（`:69`、`:78`、`:118`、`:130`）。变更只改本文件，不新增 path、不动其余契约。
- 服务端模型：`servers/api/src/db/streamPlans.ts`——`startTime required`（`:16`）；`listStreamPlans` Mongo 层 `.sort({ date: 1, startTime: 1 })`（`:75`）；`findStreamPlan(date, startTime, title, excludeId?)` 按三字段判重（`:81-90`）；`toOutput`（`:39-48`）与 `createStreamPlan`/`updateStreamPlan` 入参均为三字段。集合低基数，应用层排序无性能问题。
- 服务端路由：`servers/api/src/routes/streamPlans.ts`——`parseFields`（`:33-53`）统一校验三字段，`startTime` 缺失/非法 400「开始时间格式非法」（`:42-44`）；POST 409 文案「该日该时间已有相同主题的直播计划」（`:82`）、PUT 同文案（`:114`）；`isValidTime` 复用现有 TIME_RE（`:29`）。鉴权与 REST 形态（GET 公开 / 写 admin / ObjectId 400 / 404）本期不变。
- 服务端单测：`servers/api/tests/streamPlans.test.ts` 已存在，照既有模式扩展用例。
- 前端 API 层：`apps/bookstore/features/schedule/api.ts`——`StreamPlan`（`:3-9`）、`StreamPlanInput`（`:11-15`）、`OkResponse`（`:32-38`）均含必填 `startTime: string`；`createPlan` 为**位置参数** `(date, startTime, title)`（`:78-84`），`updatePlan` 为对象入参（`:87-92`）——本期统一为对象入参并更新唯一调用点 `PlanFormDialog`（`:68-72`）。
- 表单现状：`PlanFormDialog.tsx`——`date/startTime/title` 三个 state（`:34-36`），`emptyField = !date || !startTime || !title.trim()`（`:45`），`validate()` 强制时间（`:48-55`），提交恒带 `startTime: parseTimeStr(startTime)!`（`:68`），409 文案固定「该日该时间已有相同主题的直播计划」（`:89`），`TimePicker` 恒渲染（`:128`）。编辑态由父组件变更 key 重置初始值（组件注释 `:25`），新增 `timeType` state 照此由 `initial` 初始化即可。
- `{schedules}` 渲染：`weeklyImage/scheme.ts` 的 `buildDaySchedulesText`（`:135-138`）按 `startTime` 升序、`` `${startTime} ${title}` `` 以「 / 」拼接；`weekly-image-scheme.test.ts` 已导入该函数。fixed 渲染逐字不变则存量用例零改动仍绿。
- 混排与展示点：`mergeEntries.ts`——`CalendarEntry` plan 分支携带整个 `plan` 对象（`:4`），排序 `date || startTime`（`:62-64`）；`CalendarView.tsx` 格子时间槽位 `:77`、日内容排序 `:161`；`DayDetailDialog.tsx` 排序 `:61`、历史时间 `:94`（「实际播出」标签 `:98`）、计划时间 `:114`、删除确认文案含 `p.startTime` `:139`；`TodaySchedule.tsx` 排序 `:53`、时间槽位 `:67`。
- **`WeeklySchedule.tsx` 现态偏差**：`apps/bookstore/AGENTS.md` 明确「`WeeklySchedule.tsx` 不再由首页挂载」——该组件存在（时间槽位 `:114`）但首页不渲染。PRD F3 的「首页每周日程」验收点实际无挂载入口。处理口径：组件仍按统一排序与类型标识同口径改造（防止未来重挂载时口径漂移），验收以 `TodaySchedule` 与日历为准，e2e 不为未挂载组件新增断言。此为本期对 PRD 的细化说明而非行为偏差。
- 测试设施：`tests/api/src/stream-plans.test.ts` 黑盒用例齐备（GET 排序 `:44/:62`、POST 400 `:125`、409 `:139` 等 describe 结构），新增用例按既有命名 `stream-plans-<method>-<case>` 扩展；e2e `tests/e2e/src/backdoor/schedule.spec.ts` 与 `tests/e2e/src/bookstore/calendar.spec.ts` 已存在，直接扩展。
- 文档同步面：上线 PR 内需更新 `docs/product/spec/schedule-admin.md`、`docs/product/spec/calendar.md`、`docs/engineering/spec/backend-schedule.md`（提案 §5.3），以及 `servers/api/AGENTS.md`（stream-plans 关键约定段）、`apps/bookstore/AGENTS.md`（周表/直播计划约定段）。

整体顺序（**串行**，唯一开发分支 `feat/weekly-schedule-flexible-time`，依赖链：契约 → 后端 → 前端共享模块 → 表单 → 展示适配 → 集成/e2e → 文档收尾）：
**切开发分支 → 契约更新 → 服务端实现（TDD）→ 前端 timeType.ts + api.ts（TDD）→ PlanFormDialog 表单联动 → 渲染与展示适配 → API 集成测试 → e2e → spec/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 契约 | `StreamPlan.startTime` 必填；判重/排序口径仅三字段 | 新增 `TimeType` 枚举（fixed/tbd/allDay，缺省 fixed）；`startTime` 移出 required 改可空 + 条件必填描述；400/409/GET 排序描述更新 |
| 服务端模型 | `startTime required`；Mongo 排序 `{date:1,startTime:1}`；判重（date,startTime,title） | `timeType` 枚举字段缺省 `fixed`；`startTime` 非必填（tbd/allDay 存 null）；判重键扩为四元组；Mongo 排序退化 `{date:1}` + 应用层统一比较 |
| 服务端校验 | `parseFields` 强制三字段 | `timeType` 缺省 fixed；非法枚举 400；fixed 缺/非法 startTime 400（现状）；tbd/allDay 携带 startTime 400；409 文案随类型 |
| 前端 API 层 | `startTime: string` 必填；`createPlan` 位置参数 | `timeType: TimeType`、`startTime: string \| null`；create/update 统一对象入参；读取侧 `timeType ?? "fixed"` 防御 |
| 表单 | 三段式强制开始时间 | 「日程类型」单选（固定时间默认/时间待定/全天）；tbd/allDay 隐藏 TimePicker 且不参与校验；切换类型清空时间 |
| `{schedules}` 渲染 | `startTime 主题` 按时间升序 | fixed `20:00 主题`（逐字不变）/ tbd `TBD 主题` / allDay `主题`；排序 全天→fixed 升序→TBD |
| 日历/详情/首页 | 时间槽位恒显 `HH:mm`，按 startTime 排序 | allDay 显「全天」、tbd 显「TBD」；统一比较函数排序；历史记录混排语义不变（视同 fixed 秩） |
| 文档 | spec/AGENTS.md 无 timeType 记录 | 同 PR 同步三个 spec + 两个 AGENTS.md |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/weekly-schedule-flexible-time`；
- 开发工作（契约 + 实现 + 全部测试）在**唯一开发分支** `feat/weekly-schedule-flexible-time` 上进行（自 `prd/weekly-schedule-flexible-time` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/weekly-schedule-flexible-time` 切出 `feat/weekly-schedule-flexible-time` 并推送。

**验证**：`git branch --show-current` 为 `feat/weekly-schedule-flexible-time`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：契约更新（contract/stream-plans.openapi.yaml）

- `components.schemas` 新增 `TimeType`：`type: string`、`enum: [fixed, tbd, allDay]`、`default: fixed`，description 写明三类语义与缺省；
- `StreamPlan`：`required` 改为 `[id, date, timeType, title, createdAt]`；新增 `timeType: { $ref: TimeType }`；`startTime` 改 `anyOf: [StartTime, type: "null"]`，description「仅 timeType=fixed 时有值；tbd/allDay 为 null」；
- POST/PUT 请求体：`required` 改为 `[date, title]`，新增 `timeType` 属性、`startTime` 可空；组合约束写入端点 description：「`timeType` 缺省 `fixed`；`fixed` 时 `startTime` 必填且合法；`tbd`/`allDay` 时 `startTime` 必须为空（null 或缺省），携带非空 `startTime` 返回 400」（OpenAPI 不表达条件必填，与既有「真实日期/时间由服务端校验」口径一致）；
- 400 描述补「timeType 非法、timeType 与 startTime 组合非法」；409 描述改「同日同类型同时间同主题已存在（编辑排除自身）」；GET description 与 200 描述排序口径改「按 date 升序，同日按 全天 → 固定时间（startTime 升序）→ 时间待定」；
- 201/200 响应体同步返回 `timeType` 与可空 `startTime`；`info.version` 升 1.2.0。

**验证**：契约文件可被 OpenAPI 校验工具解析；`git diff` 仅本文件。

### 步骤 2：服务端实现（servers/api，TDD）

先写失败单测再实现。加载 `servers/api/AGENTS.md` 与 `docs/engineering/backend-rules.md`。

1. `src/db/streamPlans.ts`：
   - `export type TimeType = "fixed" | "tbd" | "allDay"`；schema 增 `timeType: { type: String, enum: ["fixed","tbd","allDay"], required: true, default: "fixed" }`；`startTime` 去 `required`；
   - `StreamPlanDoc`/`StreamPlanOutput` 增 `timeType`（doc 侧可选以兼容存量）、`startTime` 改 `string | null`（Output 侧）；`toOutput` 归一 `timeType: doc.timeType ?? "fixed"`、`startTime: doc.startTime ?? null`；
   - `createStreamPlan`/`updateStreamPlan` 入参增 `timeType`、`startTime: string | null`；
   - `findStreamPlan(date, timeType, startTime, title, excludeId?)` 判重条件 `{ date, timeType, startTime: startTime ?? null, title }`；
   - `listStreamPlans` 改 `.sort({ date: 1 })`，应用层用模块内比较函数稳定排序：同日类型秩 `allDay:0 < fixed:1 < tbd:2`，fixed 间 `startTime.localeCompare`（null 兜底空串）——服务端不 import 前端代码，本模块自写小型比较函数，与前端 `timeType.ts` 同口径、由两端测试互锁；
2. `src/routes/streamPlans.ts`：`parseFields` 扩展——`timeType` 缺省 `"fixed"`，非枚举值 400「日程类型非法」；`fixed` 时 `startTime` 缺失/非法 400（沿用现状文案「开始时间格式非法」）；`tbd`/`allDay` 时 `startTime` 非空（非 null 且非 undefined 且非空串）→ 400「时间待定/全天日程无需填写开始时间」；date/title 校验不变；POST/PUT 调用 `findStreamPlan` 传四元组，写库时 `tbd`/`allDay` 的 `startTime` 一律置 null（不信任客户端置空）；409 文案：fixed 沿用「该日该时间已有相同主题的直播计划」，tbd/allDay 用「该日已有相同主题的同类型日程」；响应体补 `timeType` 与 `startTime ?? null`；
3. 单测 `servers/api/tests/streamPlans.test.ts` 扩展：三类型创建（tbd/allDay 不带 startTime → 输出 `startTime: null`、`timeType` 正确）；缺省 `timeType` 按 fixed 处理；组合校验三类 400；判重 409（同日同 TBD 同主题、同日同全天同主题；同日 TBD 与全天同主题不 409；PUT 排除自身）；`listStreamPlans` 混合类型排序断言；既有用例不动仍绿。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端共享模块与 API 层（apps/bookstore，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。

1. 新增 `features/schedule/timeType.ts`：
   - `export type TimeType = "fixed" | "tbd" | "allDay"`；
   - 类型秩 `timeTypeRank(t): number`（allDay 0 / fixed 1 / tbd 2）；
   - `comparePlans(a, b): number`——先 `date.localeCompare`，再类型秩，再 `startTime`（null 兜底 `""`，fixed 间即时间升序）；入参取 `{ date, timeType, startTime }` 最小结构（结构化类型，plan 与混排条目均可用）；
   - `formatPlanLabel(plan): string`——fixed `` `${startTime} ${title}` ``、tbd `TBD ${title}`、allDay `${title}`；
   - 时间槽位文案 `planTimeSlot(plan): string`——fixed `startTime`、tbd `「TBD」`、allDay `「全天」`（日历/详情/首页的时间位置复用）；
2. `features/schedule/api.ts`：`StreamPlan` 增 `timeType: TimeType`、`startTime: string | null`；`StreamPlanInput` 增 `timeType`、`startTime?`；`OkResponse` 同步；`createPlan` 改对象入参 `createPlan(input: StreamPlanInput)`（与 `updatePlan` 对齐）；读取侧归一 `timeType ?? "fixed"` 防御；
3. 单测：新增 `tests/unit/schedule-time-type.test.ts`——类型秩、`comparePlans`（date 优先 / 同日类型序 / fixed 升序 / null 兜底）、`formatPlanLabel` 与 `planTimeSlot` 三类型输出；`schedule-api.test.ts` 适配 createPlan 对象入参。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 4：后台表单联动（PlanFormDialog.tsx）

- 新增 `timeType` state（`mode === "edit" && initial ? (initial.timeType ?? "fixed") : "fixed"`）；
- 日期下方渲染「日程类型」单选组（固定时间 / 时间待定 / 全天），样式对齐后台既有控件语言（`TextField`/`PrimaryButton` 同套类名、`<label>` + radio，遵守 `docs/design/03-backdoor-design.md` token 与过渡口径）；
- `timeType === "fixed"` 才渲染 `TimePicker`；`onChange` 切换类型：切到 tbd/allDay 清空 `startTime`，切回 fixed 不恢复（需重选）；
- `emptyField = !date || !title.trim() || (timeType === "fixed" && !startTime)`；`validate()` 中时间相关两条仅 fixed 生效；
- 提交入参：fixed → `{ date, timeType, startTime: parseTimeStr(startTime)!, title }`；tbd/allDay → `{ date, timeType, title }`；`createPlan` 调用点改对象入参；`onSaved` 回填 `timeType` 与 `startTime ?? null`；
- 409 文案随类型：fixed 沿用现状，tbd/allDay 「该日已有相同主题的同类型日程」；
- 单测 `schedule-plan-form-dialog.test.tsx` 扩展：默认选中固定时间；切 tbd/allDay 隐藏 TimePicker、清空已选时间、校验不再要求时间；切回 fixed 时间为空需重选；编辑态按 `initial.timeType` 回显；三类型提交入参形态断言。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 5：渲染与展示适配（{schedules} / 日历 / 详情 / 首页）

- `weeklyImage/scheme.ts` `buildDaySchedulesText`：排序改 `comparePlans`、格式化改 `formatPlanLabel`（自 `../timeType` 导入）；fixed 输出逐字不变，存量用例零改动应仍绿；`weekly-image-scheme.test.ts` 新增 tbd/allDay 渲染与混合排序拼接用例（含「 / 」连接、全天最前、TBD 最后）；
- `mergeEntries.ts`：plan 分支条目携带 `timeType`（或直接以 `plan.timeType ?? "fixed"` 参与比较）；混排排序扩展为：`date` → 条目秩（allDay 计划 0 / 历史与 fixed 计划 1，二者间按 `startTime` 混排保持现逻辑 / tbd 计划 2）；历史记录语义不变（恒有折算时间、视同 fixed 秩）；`schedule-merge-entries.test.ts` 扩展 allDay 最前 / tbd 最后 / 历史混排零回归用例；
- `CalendarView.tsx`：`:161` 日内容排序改统一比较（历史条目折算时间视同 fixed）；`:77` 时间槽位改 `planTimeSlot`（历史条目仍显折算时间）；
- `DayDetailDialog.tsx`：`:61` 排序同上；`:114` 计划时间槽位改 `planTimeSlot`；`:139` 删除确认文案对 tbd/allDay 用 `formatPlanLabel` 或「TBD/全天 + 主题」形态（避免出现空时间）；历史条目 `:94/:98` 不动；
- `TodaySchedule.tsx`：`:53` 排序改 `comparePlans`、`:67` 时间槽位改 `planTimeSlot`；`home-today-schedule.test.tsx` 扩展；
- `WeeklySchedule.tsx`（未挂载，同口径防漂移）：`:114` 时间槽位改 `planTimeSlot`，排序改 `comparePlans`；
- 视觉：类型标识使用既有 token 与字号体系，不引入新色；「全天」「TBD」占位与原 `HH:mm` 同一槽位，防布局抖动。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 6：API 集成测试（tests/api，SKILL: z-test）

- `tests/api/src/stream-plans.test.ts` 扩展，用例只依据契约与 PRD 编写（禁止对照实现），命名沿用 `stream-plans-<method>-<case>`：
  - 三类型创建成功：tbd/allDay 不带 `startTime` → 201，响应 `timeType` 正确、`startTime: null`；编辑改类型（fixed→tbd）200 且 `startTime` 归 null；
  - 组合校验 400：fixed（含缺省 timeType）缺/非法 `startTime`（现状回归）、tbd/allDay 携带 `startTime`、非法 `timeType` 值；
  - 判重 409：同日同 TBD 同主题、同日同全天同主题；同日 TBD 与全天同主题 → 均 201 不冲突；PUT 排除自身；
  - 兼容：不携带 `timeType` 的旧请求体行为与现状逐一致（fixed 语义、409 口径不变）；
  - GET 排序断言：构造同日 allDay + 多条 fixed + tbd 混合数据，断言「全天 → fixed 按 startTime 升序 → TBD」；
- 运行方式不变：`cd infra/aspire && aspire start`，`aspire describe` 注入 `API_BASE_URL` 后 `pnpm vitest run src/stream-plans.test.ts`。

**验证**：新增与既有用例全部通过。

### 步骤 7：E2E 测试（tests/e2e）

- `src/backdoor/schedule.spec.ts` 扩展：后台表单选「时间待定」/「全天」→ 时间控件隐藏 → 保存成功 → 日历格子与当日详情显示「TBD」/「全天」标识、无伪时间；编辑回显类型；固定时间路径零回归；
- `src/bookstore/calendar.spec.ts` 扩展：公开日历类型标识与同日排序（全天最前、TBD 最后）；历史直播混排既有用例零回归；
- 周表图片 `{schedules}`：经后台「生成周表图片」弹层断言 TBD/全天条目渲染文本（沿用既有弹层用例的取数与断言方式）；
- 运行方式不变（Aspire 编排 + `BOOKSTORE_BASE_URL`/`API_BASE_URL` 注入）。

**验证**：新增与既有 e2e 用例全部通过。

### 步骤 8：收尾与验收

1. Spec 同步（提案 §5.3）：`docs/product/spec/schedule-admin.md`（表单日程类型、判重键口径）、`docs/product/spec/calendar.md`（类型标识与统一排序）、`docs/engineering/spec/backend-schedule.md`（timeType 字段、组合校验、判重键、排序口径）；
2. AGENTS.md 同步：`servers/api/AGENTS.md` stream-plans 关键约定段（timeType/判重键/排序）；`apps/bookstore/AGENTS.md` 周表约定段（`timeType.ts` 共享模块、表单类型联动、渲染口径）；
3. 核对提案 §10 与 PRD §1.3 验收标准全量通过（三类型 CRUD、组合校验 400、判重 409、统一排序与渲染、旧请求/存量零回归、历史混排零回归、`pnpm lint && pnpm test` 全绿、spec 同步完成）；
4. 推送 `feat/weekly-schedule-flexible-time`，提 PR 回合 `prd/weekly-schedule-flexible-time`（PR #121 随之更新）。

## 4. 依赖与风险

- **依赖**：既有 stream-plans 全链路（契约/路由/模型/前端组件）均已上线；本地 Aspire 与容器运行时可用（集成/e2e 编排）；无新外部依赖、无新配置项、无 Aspire 变更；
- **风险**：展示点分散（scheme/mergeEntries/CalendarView/DayDetailDialog/TodaySchedule/WeeklySchedule 六处）——以 `timeType.ts` 共享模块收敛排序与文案，单测锁定比较函数，e2e 覆盖公开日历与后台日历两条路径防漏改；
- **风险**：`startTime` 由 required 放宽为可选——写入路径仅本路由一处，组合校验在路由层兜住；模型层不加条件校验，与既有「校验在路由、模型从简」分层一致；
- **风险**：存量文档无 `timeType` 字段——读取归一（`?? "fixed"`）一处代码覆盖，零迁移；前端读取侧同样防御；
- **偏差说明**：`WeeklySchedule.tsx` 现态不由首页挂载（见前提事实），PRD F3 每周日程验收以组件同口径改造 + `TodaySchedule`/日历可见路径为准；若评审认为需恢复挂载，应另起需求，不在本期范围。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-08-weekly-schedule-flexible-time-prd.md]]
- 技术提案：[[../proposals/2026-09-08-weekly-schedule-flexible-time-proposal.md]]
- 契约：`contract/stream-plans.openapi.yaml`
- 产品 Spec（现态）：`../../product/spec/schedule-admin.md`、`../../product/spec/calendar.md`
- 工程 Spec（现态）：`../spec/backend-schedule.md`
- 开发规范：[[../frontend-rules.md]]、[[../backend-rules.md]]
