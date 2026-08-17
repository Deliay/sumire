---
description: 直播计划体验优化实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（单一开发分支 feat/schedule-ux-polish：DatePicker/TimePicker autoComplete=off、周表图 2× 超采样抗锯齿、后台日历 6 行等高顶满、@theme pulse 降速 3.2s；纯前端无契约变更；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 直播计划体验优化 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-17-schedule-ux-polish-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-17-schedule-ux-polish-proposal.md]]（v1.0）
**关联契约**: 无变更（`contract/stream-plans.openapi.yaml` 不动）
**需求总分支**: `prd/schedule-ux-polish`
**开发分支**: `feat/schedule-ux-polish`（自需求总分支切出，**唯一开发分支**）
**版本**: v1.0（2026-08-17）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支 `360f499` 核对代码现态）：

- `apps/bookstore/features/schedule/DatePicker.tsx:70-90` 与 `TimePicker.tsx:58-78` 的 `<input>` 均未声明 `type`/`name`/`autocomplete`，与提案 §1.1 一致；登录/改密卡片的既有 `autoComplete` 口径（`username`/`current-password`/`new-password`）本期不动；
- `features/schedule/weeklyImage/renderer.ts:33-53` 导出函数实名为 `renderWeekImage`（提案中 "renderImage" 指该函数），固定 1665×1080 1× 渲染，未设 `imageSmoothingEnabled`/`imageSmoothingQuality`；`WeeklyImageDialog` 通过 prop 注入 `renderImage`，单测以 `vi.fn()` 打桩（`tests/unit/schedule-weekly-image-dialog.test.tsx:11,25`），渲染管线内部改造对弹层测试透明；
- `app/backdoor/(dashboard)/schedule/page.tsx:125` 根容器 `flex flex-col gap-6` 无高度约束，骨架 `min-h-64`（:151）；`(dashboard)/layout.tsx:28-37` 为 `flex min-h-svh flex-col` → 中部 `flex flex-1 flex-col lg:flex-row` → `main.flex-1`（桌面为横向 flex 被拉伸项，高度确定）；
- `features/schedule/CalendarView.tsx`：月视图根 `w-full select-none`（:284），周表头与 42 格同在 `grid grid-cols-7 gap-1`（:307）一个网格内，`DayCell` 为 `min-h-16`（:107）；`dateUtils.monthGrid` 恒返回 42 格（月末补位到 6 行满，`dateUtils.ts:58-66`），`grid-rows-6` 均分前提成立；
- `app/globals.css` `@theme`（:9-42）未定义 `--animate-pulse`（走 Tailwind v4 内置 2s）；`prefers-reduced-motion` 兜底（:135-151）已将全部动画/过渡压到 0.01ms，自定义时长后继续生效；全站 `animate-pulse` 共 4 处骨架：`schedule/page.tsx:151`、`CalendarViewPage.tsx:74`、`features/home/WeeklySchedule.tsx:91`、`features/danmaku/components/FeedSection.tsx:134`。

整体顺序：**切开发分支 → F1 输入框 autoComplete（TDD）→ F2 周表图超采样 → F3 日历等高顶满（TDD）→ F4 骨架降速 → 收尾验收**。本期纯前端、改动面小且互不耦合，由**一个前端 subagent 顺序完成** F1–F4（共享唯一开发分支，不并行）。提案 §6.2「分支自 main 切出」以本文档为准：开发分支自需求总分支 `prd/schedule-ux-polish` 切出（其本身自 main 切出，含 PRD/提案/本文档），与既往实现方案口径一致。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 表单输入框 | DatePicker/TimePicker `<input>` 无 `autoComplete`，浏览器自动填充联想遮挡定制浮层 | 显式 `autoComplete="off"`，浮层/键入/只读交互不变 |
| 周表图渲染 | 1665×1080 1× 直接 `fillText`，无平滑设置，部分浏览器文字锯齿 | 2× 离屏超采样绘制 → `imageSmoothingQuality: "high"` 缩回 1665×1080 导出，版式/配色/字号零改动 |
| 后台日历布局 | 页面容器无高度约束、骨架 `min-h-64`、格子 `min-h-16` 行高随内容不齐 | 容器顶满视口剩余高度，月视图 6 行 `1fr` 等高，骨架与日历同占满，加载/翻月无跳变 |
| 骨架动画 | 全站 4 处 `animate-pulse` 用内置 2s 周期 | `@theme` 覆盖 `--animate-pulse` 为 3.2s，一处改动全站生效，减少动态兜底不变 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/schedule-ux-polish`；
- 开发工作全部在**唯一开发分支** `feat/schedule-ux-polish` 上进行（自 `prd/schedule-ux-polish` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/schedule-ux-polish` 切出 `feat/schedule-ux-polish`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/schedule-ux-polish`。

### 步骤 1：F1 输入框关闭自动填充（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。全程 TDD：先失败测试再实现。

1. 单测先行：`tests/unit/schedule-pickers.test.tsx` 增补断言——DatePicker「日期」输入框与 TimePicker「开始时间」输入框的 `autocomplete` 属性为 `"off"`（`getByLabelText(...).getAttribute("autocomplete")`）；
2. `DatePicker.tsx:70` 与 `TimePicker.tsx:58` 的 `<input>` 增加 `autoComplete="off"`；`readOnly={!open}`、聚焦开浮层、键入容错逻辑一律不动；
3. 既有用例（聚焦开浮层、快捷时段、容错键入）保持绿。

**验证**：`pnpm -C apps/bookstore test -- schedule-pickers` 全绿。

### 步骤 2：F2 周表图 2× 超采样抗锯齿（subagent）

`features/schedule/weeklyImage/renderer.ts` 的 `renderWeekImage` 改两段渲染（对调用方透明，签名不变）：

1. 离屏 canvas `CANVAS_WIDTH*2 × CANVAS_HEIGHT*2`（3330×2160），`ctx.scale(2, 2)` 后按原逻辑绘制底图与全部文字（`TEXT_COLOR`/`FONT_STACK`/坐标/字号零改动，`layout.ts` 不动）；
2. 目标 canvas 1665×1080，`imageSmoothingEnabled = true`、`imageSmoothingQuality = "high"`，`drawImage(离屏, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)` 缩回，`toDataURL("image/png")` 导出；
3. `WeeklyImageDialog` 与既有弹层单测零改动（`renderImage` 经 prop 注入打桩，内部管线透明）；jsdom 无真实 Canvas 光栅化，抗锯齿效果以本地目检为准（验收标准条目）；
4. 素材坐标口径不变（`public/assets/original/AGENTS.md`），底图同源分发约束不变。

**验证**：`pnpm -C apps/bookstore test -- schedule-weekly-image-dialog` 全绿；本地 `pnpm dev` 生成周表图目检：导出 1665×1080，文字边缘平滑，底图与文字相对位置与现版一致。

### 步骤 3：F3 后台日历等高且容器顶满（subagent，TDD）

1. 单测先行：`tests/unit/schedule-calendar-view.test.tsx` 增补断言——月视图格子网格容器含 `grid-rows-6` 且带高度占满 class；`DayCell` 含 `h-full` 与 `overflow-hidden`；既有 42 格渲染、+N 截断、周视图用例保持绿；
2. `CalendarView.tsx` 月视图：周表头（`WEEKDAYS` 行）与 42 格拆为两个并列网格（表头 `grid-cols-7` 自然高度；格子网格 `grid h-full min-h-0 flex-1 grid-cols-7 grid-rows-6`），月视图根容器改 `flex h-full w-full flex-col select-none`；`DayCell` 由 `min-h-16` 改 `h-full min-h-16 overflow-hidden`（保留 `min-h-16` 兜底：公开页 `CalendarViewPage` 为内容流式布局、容器高度不确定时格子行高与现态一致）；
3. 周视图（<640px）与 `DayDetailDialog` 不动；公开页展示规则（每日 ≤2 条、+N）不动；
4. `app/backdoor/(dashboard)/schedule/page.tsx`：根容器 `flex flex-col gap-6` 增 `h-full min-h-0`（`main` 为横向 flex 被拉伸项，高度确定，`h-full` 可解析；若实测不生效则以 `(dashboard)/layout.tsx` 的 `main` 增 `flex flex-col` 配合、并回归弹幕看板页不受影响）；日历/骨架容器 `flex-1 min-h-0` 顶满，骨架 `min-h-64` 改 `h-full`（与日历同占满，消除加载跳变）；容器加 `min-h-[480px]` 兜底（极小视口允许页面滚动，不挤压格子）；
5. 翻月加载态与完成态共用同一占满容器。

**验证**：`pnpm -C apps/bookstore test -- schedule-calendar-view` 全绿；`pnpm -C apps/bookstore build` 通过；本地目检：月视图 6 行等高、容器顶满、骨架与内容无高度跳变、<640px 回退周视图不变、公开页 `/calendar` 外观不变。

### 步骤 4：F4 骨架动画降速（subagent）

1. `app/globals.css` 的 `@theme` 内追加：`--animate-pulse: pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;`（keyframe `pulse` 为 Tailwind v4 内置，仅覆盖时长与函数，全站 4 处 `animate-pulse` 统一生效）；
2. 不新增独立 token、不逐处替换 class；`prefers-reduced-motion` 兜底（globals.css:135-151）不动；
3. 纯 CSS 时长调整，无单测断言（jsdom 不计算动画时长）；以后台「过渡 ≤200ms」规范不受影响为 review 检查点（骨架为持续动画，不在该约束范围）。

**验证**：`pnpm -C apps/bookstore build` 通过（CSS 合法）；本地目检 4 处骨架呼吸周期约 3.2s；系统开启「减少动态效果」后骨架静态呈现。

### 步骤 5：e2e 与 API 测试回归

无新增页面/端点、契约零变更：不新增 e2e 与 API 用例。Aspire 编排下 `tests/e2e` 既有直播计划/后台用例与 `tests/api` 全量回归保持绿（SKILL: z-test）。

**验证**：Aspire 编排下 e2e（配置形态）与 `tests/api` 全量通过。

### 步骤 6：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/schedule-admin.md`（autoComplete 口径、周表图超采样渲染、日历等高顶满现态）、`docs/product/spec/calendar.md`（骨架降速现态，如涉公开页口径）、`docs/engineering/spec/frontend-bookstore.md`（对应模块现态与 `--animate-pulse` token）；
2. 更新 `apps/bookstore/AGENTS.md`「周表 / 直播计划约定」段（autoComplete=off、2× 超采样、月视图 6 行等高顶满、骨架 3.2s 口径）；PRD 与提案为时点文档，不改原文；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（含 Chrome/Firefox/Safari 目检项）；
4. `pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；
5. 推送 `feat/schedule-ux-polish` 并提 PR 至 `prd/schedule-ux-polish`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：既有 `features/schedule` 全部实现与素材（`weekly-schedules-raw.jpg` 及坐标）为改造基底；无新增依赖、无契约/服务端/编排变更；
- **并行协调**：单一开发分支 `feat/schedule-ux-polish`，一个前端 subagent 顺序执行 F1→F4（四步互相独立但共享分支，不并行）；e2e/API 仅回归；
- **风险**（对应提案 §5.2 与 PRD §3.4）：
  - 个别密码管理器扩展无视 `autocomplete="off"`——属扩展行为，PRD 已明确不对抗（步骤 1）；
  - 2× 超采样内存短暂上升（约 28MB）——生成完成即释放；超老设备耗时略增在毫秒级（步骤 2，提案 §5.2 已接受）；
  - `h-full` 在 `main` 上解析不确定——首选页面根 `h-full`，实测不生效则 `main` 增 `flex flex-col` 并回归弹幕看板页（步骤 3.4）；
  - 极小视口格子过矮——容器 `min-h-[480px]` 兜底允许页面滚动（步骤 3.4，PRD §3.4 口径）；
  - 月视图周表头与格子同网格导致 `grid-rows-6` 误配——拆为两个并列网格（步骤 3.2），单测断言网格 class。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-17-schedule-ux-polish-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-17-schedule-ux-polish-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]；后台设计：`docs/design/03-backdoor-design.md`
- 产品 Spec（现态）：`docs/product/spec/calendar.md`、`docs/product/spec/schedule-admin.md`
- 素材坐标口径：`apps/bookstore/public/assets/original/AGENTS.md`
- 既往实现方案（格式参照）：[[2026-08-17-danmaku-board-v2-impl-plan.md]]
