---
description: 首页视觉效果优化3期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/home-visual-v3，唯一开发分支 feat/home-visual-v3，纯前端零新依赖无契约变更。日历轨：dateUtils 新增 monthGridRange 纯函数（复用 monthGrid 首末格），CalendarView.goMonth / CalendarViewPage 首屏 / 后台 schedule 页初始 range 三处口径改网格范围，渲染侧零改动；动效轨：features/home 新增 parallax.ts（pointerOffset/tiltOffset/lerp 纯函数）+ useParallax.ts（pointermove+deviceorientation 双输入、rAF lerp 直写 transform、iOS 首次触摸静默请求权限）+ ParallaxLayer.tsx 驱动首页立绘视差，glowParticles.ts（spawnPosition 指针偏置/stepParticles/maxParticles 纯函数）+ GlowParticles.tsx（Canvas 2D 粒子层、DPR/resize/document.hidden 暂停、getComputedStyle 读 @theme token 取色）；reduced-motion 降级保留特批口径（鼠标视差幅度 1/3、传感器不启用、粒子减半降速去明灭，useMediaQuery 响应式订阅运行时切换即时生效，仅首页氛围层）；单测/e2e 全覆盖，spec 与设计文档同 PR 同步。
type: Permanent
---

# 首页视觉效果优化 3 期实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-31-home-visual-v3-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-31-home-visual-v3-proposal.md]]（v1.0）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
**需求总分支**: `prd/home-visual-v3`
**开发分支**: `feat/home-visual-v3`（自需求总分支切出，**唯一开发分支**，前端/测试全部实现同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-08-31）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支 `prd/home-visual-v3` 核对代码现态）：

- 首页 `apps/bookstore/app/(site)/page.tsx`（75 行，Server Component）：根容器 `relative flex h-svh flex-col overflow-hidden`（`:16`）；雾气两团 `.fog`（`:18-19`）；立绘容器 `pointer-events-none absolute inset-x-0 top-[10%] h-[90%] lg:left-auto lg:right-[10%] lg:w-1/2`（`:22-31`，`Image priority object-cover object-top`）；左列内容（`:34-67`）；`Footer floating`（`:70-72`）。**无粒子层、无视差接线**；`features/home/` 现仅 `api.ts`/`LiveStatus.tsx`/`TodaySchedule.tsx`/`WeeklySchedule.tsx`。
- `lib/useMediaQuery.ts`（29 行）：`useSyncExternalStore` 封装 matchMedia，订阅 `change` 事件、SSR 快照固定 false——**响应式订阅现成**，直接复用于 `(prefers-reduced-motion: reduce)`；已有单测 `tests/unit/use-media-query.test.ts`。
- `app/globals.css` `@theme`：`--color-flower: #8b5fd6`（`:29`）、`--color-primary: #b4a6bf`（`:11`）、`--color-eye: #7fb0e6`（`:31`）——粒子取色源；`prefers-reduced-motion` 媒体查询块现仅作用于 CSS 氛围动效（`:169` 起）。
- 日历纯函数 `features/schedule/dateUtils.ts`：`monthGrid(y, m)`（`:39-67`，固定 42 格，首格/末格即展示范围，跨年边界已在函数内处理）、`monthRange(y, m)`（`:76-78`，当月 1 日~月末）——`monthGridRange` 本期新增。
- `CalendarView.tsx`（334 行）：`goMonth`（`:165-172`）上抛 `monthRange`——**改 `monthGridRange`**；`goWeek`/`goToday`（`:174-186`）周口径不动；`DayCell` 补位格 `opacity-35`（`:109`）与 `clickable = inMonth && !!onSelectDay`（`:99`）弱化/不可点击口径现成不变；`DaySummaries` 对补位格 `showEmpty=false`（`:126`），取数到位后摘要自然出现，渲染侧零改动。
- 公开日历 `CalendarViewPage.tsx`：`currentMonthRange()`（`:11-14`）首屏按月区间拉取（`:24-35`）——**改当前月网格范围**；`handleRangeChange`（`:47-56`）透传上抛区间，无需改。
- 后台 `app/backdoor/(dashboard)/schedule/page.tsx`：`currentMonthRange()`（`:33-36`）初始化 `range` state（`:44`）——**同样改网格范围**；编辑/删除后 `refresh(range)`（`:64-73`）随 `range` 自动沿用网格区间，编辑落在补位格时回显不丢。
- 测试：`vitest.config.ts` node 默认 + jsdom pragma + `tests/unit/**`；已有 `schedule-dateutils.test.ts`、`schedule-calendar-view.test.tsx`（可扩展）；e2e `tests/e2e/src/bookstore/` 有 `site.spec.ts`（首页存在性断言，本期扩展）与 `calendar.spec.ts`（日历回归）；配置形态经 Aspire 注入 `NEXT_PUBLIC_API_BASE_URL`。
- 规范：`docs/engineering/frontend-rules.md`——仅 `@theme` token 色（`:48`）、氛围动效尊重 `prefers-reduced-motion`（`:49`；本期首页氛围层按 PRD §4.2 特批「降级保留」口径执行，后台不受影响）。

整体顺序（纯前端、无契约变更；**日历轨与动效轨可并行 subagent**，e2e 与文档同步收尾）：
**切开发分支 →〔日历轨：monthGridRange（TDD）→ 三处取数口径接线 + 组件测试〕∥〔动效轨：parallax.ts（TDD）→ useParallax + ParallaxLayer（TDD）→ glowParticles.ts（TDD）→ GlowParticles.tsx（TDD）→ page.tsx 接线〕→ e2e 更新 + spec/设计文档/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 首页立绘 | 静止衬底，无任何输入反馈 | 鼠标视差（平滑跟随、移出回中、仅 transform、±12px 量级）；移动端 deviceorientation 传感器视差（iOS 首次触摸静默请求权限，失败静默降级） |
| 首页背景 | 仅两团 `.fog` 雾气 | 新增 Canvas 光晕粒子层（随机产生、漂移明灭、指针附近生成密度更高、面积上限、hidden 暂停、token 取色） |
| 月视图取数 | `monthRange`（当月 1 日~月末），补位格有日程也空白 | `monthGridRange`（网格首格~末格，如 2026-08 → 2026-07-27 ~ 2026-09-06），首屏/翻月/后台三处同步 |
| 补位格展示 | 弱化 `opacity-35`、不可点击、空不渲染「—」 | **口径不变**，仅取数到位后摘要自然出现 |
| reduced-motion | CSS 动效经媒体查询关闭 | 首页氛围层「降级保留」特批：鼠标视差幅度约 1/3、传感器不启用、粒子减半降速去明灭；`useMediaQuery` 响应式订阅，运行时切换即时生效 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/home-visual-v3`；
- 开发工作（前端 + 全部测试）在**唯一开发分支** `feat/home-visual-v3` 上进行（自 `prd/home-visual-v3` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/home-visual-v3` 切出 `feat/home-visual-v3` 并推送 origin。

**验证**：`git branch --show-current` 为 `feat/home-visual-v3`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：`dateUtils.monthGridRange` 纯函数（TDD，日历轨）

加载 `apps/bookstore/AGENTS.md`。

1. `features/schedule/dateUtils.ts` 新增 `monthGridRange(y, m): { from, to }`——`const cells = monthGrid(y, m); return { from: cells[0].dateStr, to: cells[41].dateStr }`（复用 `monthGrid`，不重复造日期逻辑）。

**测试先行** 扩展 `tests/unit/schedule-dateutils.test.ts`：
- 2026-08 → `{ from: "2026-07-27", to: "2026-09-06" }`（PRD 指定例）；
- 跨年：2027-01 首格落在 2026-12 末；2026-12 末格落在 2027-01；
- 月初恰为周一的月份（无月初补位）首格即当月 1 日。

**验证**：`pnpm -C apps/bookstore test -- schedule-dateutils` 全绿。

### 步骤 2：月视图三处取数口径接线 + 组件测试（日历轨）

1. `CalendarView.tsx` `goMonth`（`:170-171`）：`monthRange` 改 `monthGridRange` 上抛；`goWeek`/`goToday`/渲染侧不动；import 同步替换；
2. `CalendarViewPage.tsx`：`currentMonthRange()` 改返当前月 `monthGridRange`（函数更名 `currentGridRange`，`:11-14`、`:25`）；
3. 后台 `schedule/page.tsx`：`currentMonthRange()` 同样改 `monthGridRange`（`:33-36`）；`refresh(range)` 逻辑不变（`range` 由上抛与初始值共同维持网格口径）。

**测试先行** 扩展 `tests/unit/schedule-calendar-view.test.tsx`：
- `goMonth`（点击「下月」）上抛网格范围（mock `onRangeChange` 断言 from/to 为新展示网格首末格，非月区间）；
- 补位格有 entries 时渲染摘要、无 entries 不渲染「—」；补位格点击不上抛 `onSelectDay`（既有弱化/不可点击口径回归）。

**验证**：`pnpm -C apps/bookstore test -- schedule-` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 3：`parallax.ts` 视差纯函数（TDD，动效轨）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。

新建 `features/home/parallax.ts`（无 DOM、可单测）：
- `pointerOffset(x, y, w, h, max): { dx, dy }`——指针坐标归一化 `[-1, 1]`、取反（视差反向）× 幅度上限；
- `tiltOffset(beta, gamma, max): { dx, dy }`——倾角钳制（±25°）后归一化 × 幅度上限；null/异常输入回 `{ dx: 0, dy: 0 }`；
- `lerp(current, target, t): number`——帧插值。

**测试先行** 新建 `tests/unit/home-parallax.test.ts`：指针四角/中心取反方向正确；幅度钳制不超 `max`；倾角 ±25° 钳制；`lerp` 收敛性与 t 边界。

**验证**：`pnpm -C apps/bookstore test -- home-parallax` 全绿。

### 步骤 4：`useParallax.ts` + `ParallaxLayer.tsx`（TDD，动效轨）

1. **`features/home/useParallax.ts`**：`useParallax(ref)` 接管 `ref` 元素 `transform`——桌面 window 级被动 `pointermove` → 目标偏移，rAF `lerp`（t≈0.08）直写 `ref.style.transform`（不触发 React 重渲染）；`pointerleave`/`blur` 目标归零回中；收敛后停帧省电。移动端 `deviceorientation`：特性检测 `DeviceOrientationEvent.requestPermission` 存在（iOS 13+）时**首次 `touchend` 回调内**静默请求，成功挂监听、拒绝/异常静默放弃；无需权限平台直接挂监听。**reduced-motion（降级保留）**：经 `useMediaQuery("(prefers-reduced-motion: reduce)")` 响应式订阅——为真时鼠标视差幅度上限降至约 1/3、**不挂 `deviceorientation` 监听、不请求权限**；effect 依赖媒体查询值，运行时切换即重跑清理/换参（含已挂载后切为 reduce 的路径）。卸载完整清理监听与 rAF；初始不写任何 transform（SSG/首渲染一致，防 hydration 差异）；
2. **`features/home/ParallaxLayer.tsx`**（`"use client"`）：透传 `children` 的视差容器，内部挂 `useParallax`，外层保留调用方传入的 className（立绘定位类由 page.tsx 决定）。

**测试先行** 新建 `tests/unit/home-parallax-layer.test.tsx`（jsdom pragma；matchMedia mock 仿 `use-media-query.test.ts`，rAF 打桩）：
- 普通环境 pointermove 后 transform 更新（lerp 逼近目标）；`pointerleave` 后回中；
- reduced-motion 时仍响应鼠标但幅度上限约 1/3、**`deviceorientation` 监听不挂载**；
- 运行时切换媒体查询（触发 change 回调）后幅度参数/传感器监听即时切换；
- 卸载清理不抛错；无 `matchMedia` 环境兜底不抛错。

**验证**：`pnpm -C apps/bookstore test -- home-parallax` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 5：`glowParticles.ts` 粒子纯函数（TDD，动效轨）

新建 `features/home/glowParticles.ts`（注入 `random` 便于确定性测试）：
- `spawnPosition(viewport, pointer | null, bias, radius, random): { x, y }`——`pointer` 存在时以概率 `bias`（约 0.6）在其 `radius`（约 160px）内取点（越界钳制到视口），否则全屏均匀；
- `createParticle(pos, random): Particle`（初速向上微漂、生命周期、尺寸、色相槽位）；
- `stepParticles(particles, dt, opts): Particle[]`（推进位移/alpha 明灭，淘汰寿终粒子；`opts` 承载降级参数——速度系数、是否明灭）；
- `maxParticles(area): number`（按视口面积收敛上限，桌面约 ≤70）。

**测试先行** 新建 `tests/unit/home-glow-particles.test.ts`：无指针全屏均匀；有指针 bias 命中落在 radius 内且越界钳制；`stepParticles` 明灭推进与寿终淘汰；降级参数下速度降低、明灭关闭；`maxParticles` 面积缩放上限。

**验证**：`pnpm -C apps/bookstore test -- home-glow-particles` 全绿。

### 步骤 6：`GlowParticles.tsx` 粒子画布（TDD，动效轨）

新建 `features/home/GlowParticles.tsx`（`"use client"`）：渲染 `<canvas aria-hidden className="pointer-events-none absolute inset-0">`；rAF 主循环 spawn（指针偏置）→ step → draw（径向渐变圆点，低 alpha 模拟柔光，**不用 `filter: blur`**）；`pointermove`/`pointerdown` 被动监听仅记录最后指针坐标；挂载时 `getComputedStyle(document.documentElement)` 读 `--color-flower`/`--color-primary`/`--color-eye`，粒子随机取其一；`resize` 重建尺寸并按 DPR 缩放；`visibilitychange`（`document.hidden`）暂停/恢复；卸载清理全部监听与 rAF。**reduced-motion（降级保留）**：同样 `useMediaQuery` 响应式订阅——为真时 canvas 仍渲染，生成上限减半、漂移降速、取消明灭（alpha 恒定低值）；运行时切换即时换参（画布与 rAF 保留）。

**测试先行** 新建 `tests/unit/home-glow-particles-canvas.test.tsx`（jsdom pragma；canvas 2D context 打桩）：
- 普通环境渲染 `canvas[aria-hidden]` 且 `pointer-events-none`；卸载清理不抛错；
- reduced-motion 时 canvas 仍渲染，传入纯函数的参数为降级档（上限减半、明灭关闭）——以 spy 断言；
- 运行时切换媒体查询后参数即时更换；`document.hidden` 时 rAF 暂停。

**验证**：`pnpm -C apps/bookstore test -- home-glow` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 7：`page.tsx` 接线与层序（动效轨）

1. `app/(site)/page.tsx`：雾气层之后、立绘容器之前插入 `<GlowParticles />`（DOM 序即 z 序：雾气 → 粒子 → 立绘 → 内容）；立绘容器（`:22-31`）移入 `ParallaxLayer`（保持原定位 className 不变）；
2. 全部新增元素 `aria-hidden`、`pointer-events-none`、`absolute` 不参与布局；`h-svh overflow-hidden` 与 Footer 条不变，CLS = 0；
3. `page.tsx` 保持 Server Component（`ParallaxLayer`/`GlowParticles` 为 Client 叶子，不 import `lib/content/index.ts`）。

**测试先行** 扩展首页结构守卫测试（可复用/新建 `tests/unit/home-visual-fx.test.tsx`）：首页渲染粒子 canvas 容器与 ParallaxLayer 包裹的立绘；`API_CONFIGURED` 守卫行为不受影响（LiveStatus/TodaySchedule 回归）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；本地 `aspire start` 手工走查桌面（1280×800）与移动（375×667）：视差平滑、粒子漂移明灭、指针附近密度更高、一屏无滚动无 CLS、系统开启减少动态后降级生效。

### 步骤 8：e2e、Spec 同步与收尾验收

1. **e2e**（SKILL: z-test）扩展 `tests/e2e/src/bookstore/site.spec.ts`：首页存在粒子 canvas 且 `pointer-events-none`、立绘层存在；`page.emulateMedia({ reducedMotion: "reduce" })` 下粒子 canvas 仍存在（降级渲染）；`calendar.spec.ts` 增补（API 配置形态）月视图补位格日程展示回归、翻月按新网格范围重拉回归、移动端周视图口径不变回归；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：
   - `docs/product/spec/site-pages.md`：首页氛围层现态（立绘视差/传感器视差/光晕粒子、reduced-motion 降级保留特批口径及范围）；
   - `docs/product/spec/calendar.md`：月视图按展示网格范围取数现态（公开页 + 后台同口径、补位格弱化/不可点击不变）；
   - `docs/design/02-page-design.md`：粒子层视觉语言（取色 token、密度/尺寸/明灭参数定稿值）与视差幅度定稿值；
   - `apps/bookstore/AGENTS.md`：`features/home/` 新增模块（ParallaxLayer/useParallax/parallax/GlowParticles/glowParticles）与 `monthGridRange` 口径记录；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；`pnpm lint && pnpm test && pnpm build`（apps/bookstore）与 e2e 全绿；
4. 推送 `feat/home-visual-v3` 并提 PR 至 `prd/home-visual-v3`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：零新包。既有 `monthGrid`/`listPlans`/`useMediaQuery` 全部复用；`GET /api/stream-plans` 契约不变（仅调用参数区间变宽，在契约支持范围内）；Aspire 四资源编排无新增配置。
- **并行协调**：日历轨（步骤 1-2）与动效轨（步骤 3-7）无文件交叉，可并行 subagent；步骤 8 的 e2e 依赖两轨完成。
- **风险**（对应提案 §5.2 与核对发现）：
  - **iOS 权限时机**：`requestPermission()` 必须在用户手势（首次 `touchend`）回调内调用，不得页面加载即弹；拒绝/异常后无残留状态、无提示 UI；
  - **hydration 一致性**：站点纯静态导出，视差初始不写 transform、粒子 canvas 无初始内容，SSG 与首渲染必须一致；
  - **reduced-motion 运行时切换**：effect 必须依赖媒体查询值——「已挂载传感器监听后切为 reduce」的路径要确实清理监听（单测覆盖）；降级口径仅首页氛围层，后台 `/backdoor` 不受影响；
  - **低端机性能**：粒子数面积上限 + `document.hidden` 暂停 + 收敛停帧 + 无 `filter: blur` 逐帧开销；仅 `transform`/`opacity` 与 Canvas 2D；
  - **取数区间变宽**：最多 42 天、跨三月边界由 `monthGrid` 既有逻辑保证；后台编辑落在补位格时 `refresh(range)` 回显不丢（步骤 2 口径联动）；
  - **token 取色**：Canvas 绘制色运行时 `getComputedStyle` 读 CSS 变量，禁硬编码；jsdom 单测需打桩 `getComputedStyle`。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-31-home-visual-v3-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-31-home-visual-v3-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]
- 设计文档：[[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
- 产品 Spec（现态）：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`
- 契约（不变）：`contract/stream-plans.openapi.yaml`
- 参考先例：[[2026-08-31-home-visual-overhaul-impl-plan.md]]（上一迭代实现方案，格式与本方案一致）
