---
description: 移动端日历周视图实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（CalendarView 响应式双形态：dateUtils 周计算纯函数、useMediaQuery 断点 hook、DayCell 提取与周切换头、onMonthChange 泛化为 onRangeChange；纯前端改造、零后端/契约变更；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 移动端日历周视图 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-15-calendar-mobile-week-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-15-calendar-mobile-week-proposal.md]]（v1.0）
**关联契约**: `contract/stream-plans.openapi.yaml`、`contract/live-history.openapi.yaml`（均复用，不变）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/calendar-mobile-week`
**开发分支**: `feat/calendar-mobile-week`（自 `prd/calendar-mobile-week` 切出）
**版本**: v1.0（2026-08-15）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已核对主线代码）：`apps/bookstore/features/schedule/CalendarView.tsx` 为 Client Component，props 为 `entries: CalendarEntry[]`、`onMonthChange(from, to)`、`onSelectDay(date)`，内部以 `view: { y, m }` 状态 + `monthGrid` 渲染 6×7 网格（格子 `min-h-16`，摘要上限 `MAX_SUMMARIES = 2`）；`dateUtils.ts` 已具备 `parseDateStr`/`monthGrid`/`monthRange`/`shiftMonth`/`toDateStr`/`WEEKDAYS`（周一开头）；两处调用点为 `features/schedule/CalendarViewPage.tsx`（公开站，`handleMonthChange` 直接 `listPlans(from, to)`）与 `app/backdoor/(dashboard)/schedule/page.tsx`（后台，`handleMonthChange` 仅 `setRange`，由 effect 按区间拉取）；二期混合条目（`mergeEntries`、历史静默降级）与取数链路已就位。本期为**纯前端增量**：扩展周计算纯函数、新增断点 hook、改造 `CalendarView` 为月/周双形态、两处调用点改名适配。整体顺序：**开发分支 → 前端实现（TDD，单 subagent）→ e2e → 收尾验收**。无契约变更、无后端变更、无编排变更。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（主线已有） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 周计算 | `dateUtils.ts` 仅有月粒度函数 | 新增 `weekDates(dateStr) → string[7]`（周一~周日）、`shiftWeek(dateStr, delta)`（±7 天步长，跨月/跨年正确）、`formatWeekRange(from, to)`（`8/10 – 8/16`，跨月/跨年两端带月份）三个纯函数 |
| 断点检测 | 不存在 | 新增 `lib/useMediaQuery.ts`：`useSyncExternalStore` 封装 `matchMedia`，`getServerSnapshot` 固定 `false`（SSR/首帧恒为月视图） |
| 日历组件 | 固定月视图，状态为 `view: { y, m }` | 双形态：`< 640px` 渲染周视图（单行 `grid grid-cols-7`，格子加高如 `min-h-28`，摘要上限提至 4，超出仍 `+N`），`≥ 640px` 维持既有月视图像素零回归；状态改为单一事实源 `selectedDate`（初始今天），月/周各自派生定位；提取同文件内 `DayCell` 子组件共用格子渲染 |
| 切换头 | 「← 上月 / 下月 →」+ 月标题 | 周视图替换为「‹ / ›」周切换 + 「今天」快捷钮，标题形如「2026 年 8 月 · 8/10 – 8/16」（跨月两端带月份）；月视图切换头不变 |
| 取数回调 | `onMonthChange(from, to)` | **改名** `onRangeChange(from, to)`，签名不变，语义泛化为「可见范围变更」：月视图传 `monthRange`，周视图传该周周一~周日；两处调用点适配，回调体逻辑不变 |
| 测试 | 二期三层测试已存在 | 增量：周计算纯函数单测（新文件）、`useMediaQuery` 单测、`CalendarView` 双形态/周切换/形态切换单测（扩展现有文件）、移动端视口 e2e |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/calendar-mobile-week`；
- 实现工作在开发分支 `feat/calendar-mobile-week` 上进行（自 `prd/calendar-mobile-week` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/calendar-mobile-week` 切出 `feat/calendar-mobile-week`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/calendar-mobile-week`；`features/schedule/` 与既有测试在位。

### 步骤 1：前端实现（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/01-visual-identity.md`、`docs/design/03-backdoor-design.md`（后台页受影响）。注意 `apps/bookstore/AGENTS.md` 的提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。全程 TDD：每一步先写/改测试确认变红，再实现转绿。

1. **`dateUtils.ts` 扩展**（先写测试 `tests/unit/schedule-dateutils-week.test.ts`）：
   - `weekDates(dateStr: string): string[]`——含 `dateStr` 的周一~周日 7 个 `YYYY-MM-DD`；以 `parseDateStr` 拆分后 `new Date(y, m-1, d)` 本地时区构造（禁用 `new Date("YYYY-MM-DD")` 的 UTC 解析），`getDay()` 周日=0 映射为 6 回推周一后顺推 7 天；
   - `shiftWeek(dateStr: string, delta: number): string`——`date ± delta*7` 天，复用同样的本地时区换算；
   - `formatWeekRange(from: string, to: string): string`——同月 `8/10 – 8/16`，跨月/跨年两端各带月份（如 `8/31 – 9/6`、`12/28 – 1/3`）；
   - 单测覆盖：当天为周一/周日边界、跨月（8/31 所在周含 9/1）、跨年（2026-12-28 所在周含 2027-01-01）、`shiftWeek` ±1/±N 跨界、`formatWeekRange` 同月/跨月/跨年三种标签；
2. **`lib/useMediaQuery.ts`**（先写测试）：`useMediaQuery(query: string): boolean`，`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` 实现——subscribe 监听 `mql` 的 `change` 事件，`getSnapshot` 返回 `mql.matches`，`getServerSnapshot` 固定 `false`；无 `matchMedia` 环境兜底 `false`；单测以 `vi.stubGlobal("matchMedia", …)` 桩覆盖初始值、`change` 事件驱动更新、SSR 快照为 `false`；
3. **`CalendarView.tsx` 双形态改造**（先改测试 `tests/unit/schedule-calendar-view.test.tsx`）：
   - 状态重构：`view: { y, m }` 改为 `selectedDate: string`（初始 `todayStr()`）单一事实源；月视图展示 `selectedDate` 所在月（派生 `y/m`），周视图展示 `weekDates(selectedDate)`；
   - 断点分流：`useMediaQuery("(max-width: 639px)")` 为真渲染周视图，为假渲染既有月视图；形态切换（断点跨越）时 `selectedDate` 不变，两视图互相定位到同一日期；
   - `DayCell` 提取：同文件内子组件承载单日格子渲染（日期数字、今天标记、过去弱化、条目摘要、`+N` 收口、历史来源样式、空天占位），月/周两形态共用；差异仅容器与参数——周视图格子 `min-h-28`、摘要上限 4（月视图保持 `min-h-16`、上限 2，`MAX_SUMMARIES` 常量按形态传入）；月视图补位格（`inMonth=false`）样式与不可点击行为原样保留；
   - 周视图结构：单行 `grid grid-cols-7`（沿用 `WEEKDAYS` 表头），切换头为「‹」「›」+「今天」按钮（样式沿用月视图切换按钮的 token 类），标题 `{y} 年 {m} 月 · {formatWeekRange(周一, 周日)}`（月份取周内多数日所在月或周一所在月，实现时以提案示例「2026 年 8 月 · 8/10 – 8/16」为准）；周切换即 `setSelectedDate(shiftWeek(selectedDate, ±1))`，「今天」即 `setSelectedDate(todayStr())`；
   - 回调泛化：props `onMonthChange` 改名 `onRangeChange`（签名不变）；月视图切换时传 `monthRange(y, m)`（替代现有从 `monthGrid` 取首末 `inMonth` 格的等价写法），周视图切换/「今天」时传该周周一~周日；**不在挂载时主动上抛**（两处页面挂载时已按当前月区间自首拉取，今天所在周必被覆盖，避免重复请求）；
   - 点天行为：`onSelectDay` 两形态一致上抛 `YYYY-MM-DD`；
   - 单测覆盖（mock `matchMedia`）：周形态渲染 7 天且默认含今天、周切换上抛正确周一~周日区间（含跨月）、「今天」回到本周、点天回调一致、断点跨越后 `selectedDate` 不丢（周→月定位到同月、月→周定位到同周）；月形态既有断言全部保持绿色（零回归准绳，先跑通再扩展）；
4. **调用点适配**（先改测试）：
   - `features/schedule/CalendarViewPage.tsx`：`handleMonthChange` → `handleRangeChange`，回调体不变（仍按区间 `listPlans(from, to)`）；
   - `app/backdoor/(dashboard)/schedule/page.tsx`：`handleMonthChange` → `handleRangeChange`（仍仅 `setRange`，由既有 effect 拉取）；
   - 挂载首拉区间维持 `currentMonthRange()` 不变（周视图首屏数据为月区间子集，天然覆盖）；
   - 历史记录独立加载、`mergeEntries`、`DayDetailDialog`、`PlanFormDialog`、`WeeklyImageDialog`、主页缎条**均不改动**；
5. 视觉约束：仅用 `@theme` token 色、无硬编码色值；后台无氛围动效、过渡 ≤200ms 且尊重 `prefers-reduced-motion`；周视图不引入占位入口之外的新 UI 文案。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 2：e2e（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`，复用现有工程（Aspire 编排，`BOOKSTORE_BASE_URL` 注入）：

1. 改造 `tests/e2e/src/bookstore/calendar.spec.ts`：新增移动端视口用例（`test.use({ viewport: { width: 390, height: 844 } })` 或独立 describe）——打开 `/calendar` 渲染周视图（恰好 7 个 `calendar-day` 格子、默认含今天）、切换上一周/下一周标题区间变化且格子日期随之平移 7 天、「今天」回到本周、点天弹层正常；桌面视口既有月视图用例保持全绿（回归准绳）；
2. 改造 `tests/e2e/src/backdoor/schedule.spec.ts`：后台「直播计划」页移动端视口抽查同口径（周视图渲染、周切换、管理态点天弹层可用）；
3. `unconfigured.spec.ts` 保持：未配置形态下 `/calendar` 404、无占位入口；
4. 回归既有 e2e 全量用例，确认无回退。

**验证**：Aspire 编排下两种构建形态 e2e 分别全绿。

### 步骤 3：收尾与验收

1. 更新 `apps/bookstore/AGENTS.md` 周表约定段：`CalendarView` 改为响应式双形态口径（`selectedDate` 事实源、`< 640px` 周视图、`onRangeChange` 语义、`lib/useMediaQuery.ts`、周计算纯函数）；根 `AGENTS.md` 无结构性变更则不动；
2. 核对提案 §10 验收标准与 PRD 功能点 1/2/3 验收标准逐条通过；
3. 推送 `feat/calendar-mobile-week` 并提 PR 至 `prd/calendar-mobile-week`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：一期/二期 `features/schedule/` 组件与取数链路已上线；无新增外部依赖（不引入日期库）；
- **并行协调**：本期仅前端一个实现面，步骤 1 单 subagent 串行即可；步骤 2 e2e 依赖步骤 1 完成；
- **风险**：
  - 时区陷阱——`new Date("YYYY-MM-DD")` 按 UTC 解析会偏移本地日期，一律 `new Date(y, m-1, d)` 本地构造（与既有 `parseDateStr`/`monthGrid` 口径一致），单测锚定跨月/跨年（步骤 1.1）；
  - 月视图零回归——`DayCell` 提取是同文件内重构，以既有 `schedule-calendar-view.test.tsx` 全绿为准绳，先跑通再扩展（步骤 1.3）；
  - 首帧闪烁——SSR/首帧恒为月视图，移动设备首帧后单帧内切换为周视图；页面为静态导出的轻量页面，无 CLS 敏感折叠内容，可接受（提案 §5.2 决策已定，不做 CSS 双渲染）；
  - 断点跨越状态丢失——单一 `selectedDate` 事实源保证形态切换上下文不丢，单测显式覆盖（步骤 1.3）；
  - 重复取数——挂载时不主动上抛 `onRangeChange`，复用页面既有首拉；周/月切换各触发一次区间拉取，不引起历史记录重复请求（历史为独立一次性加载）（步骤 1.3、1.4）；
  - 极老浏览器无 `matchMedia`——兜底 `false`（月视图），可接受（步骤 1.2）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-15-calendar-mobile-week-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-15-calendar-mobile-week-proposal.md]]（v1.0）
- 一期/二期文档：[[../../product/requirements/draft/2026-08-13-weekly-schedule-prd.md]]、[[../../product/requirements/draft/2026-08-15-weekly-schedule-v2-prd.md]]、[[2026-08-15-weekly-schedule-v2-impl-plan]]
- 视觉识别：[[../../design/01-visual-identity.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 前端规范：[[../frontend-rules.md]]
