---
description: 首页视觉效果优化4期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/home-visual-v4，唯一开发分支 feat/home-visual-v4，纯前端零新依赖无契约变更。纯函数轨：sections.ts 站序列注册表（API_CONFIGURED 过滤日历站）、fullpage.ts（wheel/touch 手势聚合一次一屏、nextIndex 钳制、resolveFlowBoundary 素材区 deck/free 边界、easing）、sectionRail.ts（buildTree/activeNode）、glowParticles.ts 冲量扩展（createFlow/impulse/decayFlow，stepParticles 可选 flow 叠加）、calendarDrag.ts（横向位移累积阈值翻月）；内容轨：features/about/parts 抽五组组件（Profile/Story/Taste/Journey/Trivia，文案零改动）供 ArchiveSection 五屏（立绘单左双右，素材仅 standing-01/02 与 illustration-01 循环选取）与 /about 复用；日历轨：CalendarView 新增 variant="immersive"（直角中字全幅、左右全高翻月竖条、拖拽翻月，panel 默认后台零影响）+ CalendarViewPage 接线；素材轨：AssetGallery 全幅化（限宽在 assets/page.tsx max-w-6xl，网格列扩展）；集成轨：useFullpageScroll + FullpageDeck + SectionRail + HeroSection + page.tsx 重构、GlowParticles fixed 常驻 + 冲量接线、NavBar 锚点化（href + hash 选中态双改）；reduced-motion 降级保留特批口径（转场淡切、冲量不启用）；单测/e2e 全覆盖，spec 与设计文档同 PR 同步。
type: Permanent
---

# 首页视觉效果优化 4 期实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-01-home-visual-v4-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-01-home-visual-v4-proposal.md]]（v1.0）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
**需求总分支**: `prd/home-visual-v4`
**开发分支**: `feat/home-visual-v4`（自需求总分支切出，**唯一开发分支**，前端/测试全部实现同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-01）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支 `prd/home-visual-v4` 核对代码现态）：

- 首页 `apps/bookstore/app/(site)/page.tsx`（80 行 Server Component）：根容器 `relative flex h-svh flex-col overflow-hidden`（`:18`）；层序 雾气 `.fog`×2（`:20-21`）→ `<GlowParticles />`（`:24`）→ `<ParallaxLayer>` 立绘（`:27-36`）→ 左列内容（`:39-72`，`LiveStatus`/`TodaySchedule` 均 `{API_CONFIGURED && ...}` 挂载 `:42-43`）→ `<Footer site floating />`（`:75-77`）。
- `app/(site)/layout.tsx`（17 行）：`<NavBar siteName tools>` + `<main className="min-h-svh">`，无 Footer；流式页脚在 `(content)/layout.tsx`（16 行，无限宽类，仅 `{children}` + 流式 `<Footer site />`）——各页面限宽在页面自身（about `max-w-4xl`、assets `page.tsx:13` `max-w-6xl`）。
- 档案 `/about` `app/(site)/(content)/about/page.tsx`（208 行 Server Component）：页头（`:71-81`）→ 信息卡 LaceFrame（`:84-119`）→ 设定故事 PaperCard（`:124-145`）→ 喜好 tagGroups（`:148-168`）→ 历程 VineTimeline（`:171-174`）→ 逸闻双列卡（`:177-195`）→ 外链 ExternalButton（`:198-205`）；`features/about/` 仅 `VineTimeline.tsx`。
- 日历 `features/schedule/CalendarView.tsx`（334 行）：props `entries/onRangeChange/onSelectDay`（`:22-29`）；`goMonth`（`:165-172`）已上抛 `monthGridRange` 网格范围；翻月按钮在内部头部（`:285-305`）；DayCell 圆角 `rounded-md border`（`:107`）、日期 `text-xs`（`:120`）、摘要 `text-[11px]`（`:61`）；`isWeek = useMediaQuery("(max-width: 639px)")`（`:139`）早退周视图（`:188-281`），月视图根容器已带 `h-full flex-col`、网格 `grid-rows-6`（`:284`、`:318`），具备全幅拉伸基础。`CalendarViewPage.tsx`（88 行）容器 `max-w-[80rem]`（`:59`）。
- 素材 `features/assets/AssetGallery.tsx`（170 行）：组件本身无宽度容器（返回 `<>`），限宽在页面 `assets/page.tsx:13` `max-w-6xl`；网格 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`（`:131`）；Lightbox 内联子组件（`:22-95`，Esc/遮罩关闭、`body.overflow=hidden`）。
- 全局 `components/NavBar.tsx`（112 行 Client）：`BASE_LINKS`（`:15-20`）href 为独立路由路径，`/calendar` 仅 `API_CONFIGURED` 时插入（`:19`）；选中态 `pathname.startsWith(href)`（`:42-43`）——**锚点化需同时改 href 形态与 isActive 口径**；移动端下拉 `ul md:hidden`（`:92-109`）。`components/Footer.tsx`（58 行）：`{ site, floating? }` 两形态（floating 通栏毛玻璃条 `:21`；流式 `mt-24`+`lace-x`+`max-w-6xl` `:22`）。
- `features/home/` 现 9 文件：`GlowParticles.tsx`（165 行，定位类 `pointer-events-none absolute inset-0` `:163`，依赖父容器 `overflow-hidden` 裁剪——**常驻 fixed 需脱离首页根容器**；props 全为可注入纯函数 `:22-28`）、`glowParticles.ts`（108 行纯函数）、`ParallaxLayer.tsx`/`useParallax.ts`/`parallax.ts`、`LiveStatus.tsx`/`TodaySchedule.tsx`/`WeeklySchedule.tsx`/`api.ts`。
- 立绘素材现状：`public/assets/original/` 仅 `standing-01`（首页在用）、`standing-02`（档案信息卡在用）两张全身立绘 + `illustration-01` 氛围插画 + promo 图——**档案五屏立绘从这三者循环选取**（PRD 口径「在现有素材中选取、各屏可有差异，以实现定稿为准」），缺图不新造。
- 测试：`apps/bookstore/tests/unit/` 68 个（home-* 9 个、schedule-* 若干，命名口径 `home-<slug>.test.ts(x)`）；e2e `tests/e2e/src/bookstore/` 有 `site.spec.ts`/`calendar.spec.ts`/`footer-link.spec.ts`。
- 规范：`docs/engineering/frontend-rules.md`——仅 `@theme` token 色；reduced-motion「降级保留」特批口径仅公开站氛围层（3 期先例，本期扩展至翻页转场与粒子冲量），后台不受影响。

整体顺序（纯前端、无契约变更；**步骤 1-8 无文件交叉，可按轨并行 subagent**；集成轨步骤 9-13 依次推进，e2e 与文档同步收尾）：
**切开发分支 →〔纯函数轨：sections.ts → fullpage.ts → sectionRail.ts → glowParticles 冲量扩展 → calendarDrag.ts〕∥〔内容轨：about/parts 抽取 + /about 复用〕∥〔日历轨：CalendarView immersive + CalendarViewPage〕∥〔素材轨：AssetGallery 全幅化〕→ 屏组件（Hero/Archive/Calendar/Assets）→ useFullpageScroll → FullpageDeck + SectionRail + page.tsx 接线 → GlowParticles 常驻/冲量接线 → NavBar 锚点化 → e2e + spec/设计文档/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 首页 `/` | 100svh 不可滚动封面页 | 整页滚动容器：8 整屏站（首页 → 档案×5 → 日历 → 素材）一次手势一屏 + 素材尾部自然滚动至 Footer；键盘可翻页；hash 可定位可分享 |
| 导航 | 独立路由 href + pathname 选中态 | 锚点 href（`/#archive-1` 等）+ hash 选中态；首页内拦截平滑翻页，其他路由正常跳转定位 |
| 位置指示 | 无 | SectionRail 竖向树状指示器（模块→子内容，当前高亮、点击跳转、键盘可达） |
| 粒子层 | 首页 `absolute inset-0` 局部背景 | `fixed` 常驻全体验；翻页/滚动冲量沿方向加速、停止后指数衰减滞留；reduce 不启用 |
| 档案 | `/about` 单页 208 行长文 | 五组内容组件抽取复用；首页档案五屏立绘左右交替（单左双右）、移动端纵排 |
| 日历 | 限宽圆角小字、头部小翻月按钮 | `variant="immersive"`：全幅直角中字、左右全高翻月竖条、横向拖拽翻月；后台 panel 默认零影响 |
| 素材 | 页面限宽 `max-w-6xl`、3 列网格 | 全幅占满屏宽、列数随屏宽扩展；筛选/Lightbox 口径不变；尾部自然滚动 + 全站单 Footer |
| 独立路由 | `/about` `/assets` `/calendar` 独立实现 | 保留，与首页模块同源组件渲染 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/home-visual-v4`；
- 开发工作（前端 + 全部测试）在**唯一开发分支** `feat/home-visual-v4` 上进行（自 `prd/home-visual-v4` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/home-visual-v4` 切出 `feat/home-visual-v4` 并推送 origin。

**验证**：`git branch --show-current` 为 `feat/home-visual-v4`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：`sections.ts` 站序列注册表（TDD，纯函数轨）

加载 `apps/bookstore/AGENTS.md`。

新建 `features/home/sections.ts`（纯数据 + 类型）：
- `type SectionId = "hero" | "archive-1" | … | "archive-5" | "calendar" | "assets"`；
- `SectionDef = { id, hash, navKey: "home"|"archive"|"calendar"|"assets", title, parent?: "archive" }`；档案 5 站 `parent: "archive"`，title 依次为 信息・Profile / 设定・Story / 喜好・Taste / 历程・Journey / 轶闻・Trivia；
- `SECTIONS: SectionDef[]`；`visibleSections(apiConfigured: boolean): SectionDef[]`（为假过滤日历站，序列收敛为 7 站）。

**测试先行** 新建 `tests/unit/home-sections.test.ts`：`visibleSections(true)` 8 站顺序正确（hero → archive-1..5 → calendar → assets）；`visibleSections(false)` 无日历站且 navKey 集合完整；档案 5 站 parent 均为 archive、hash 与 id 一致。

**验证**：`pnpm -C apps/bookstore test -- home-sections` 全绿。

### 步骤 2：`fullpage.ts` 翻页纯函数（TDD，纯函数轨）

新建 `features/home/fullpage.ts`（无 DOM、注入 `now` 便于确定性测试）：
- `createGestureState()` / `feedWheel(state, deltaY, now): { direction: 1 | -1 } | null`——同一次手势连续 delta 累加，超阈值且过冷却期只产出一个意图，随后该手势内不再产出；
- `feedTouch(start, current, now): { direction } | null`——位移阈值 + 速度下限；
- `nextIndex(current, direction, count): number`——钳制 `[0, count-1]`；
- `resolveFlowBoundary(mode, scrollTop, direction): "deck" | "free"`——素材站下滚越界 → `free`；`free` 模式 `scrollTop <= 0`（含死区 >2px 口径）且继续上滚 → `deck`；
- `easeInOutCubic(t): number`。

**测试先行** 新建 `tests/unit/home-fullpage.test.ts`：同手势连续 delta 只产出一个方向意图；冷却期内不重复产出；阈值下不产出；触控板高频小 delta 被吸收；`feedTouch` 位移/速度边界；`nextIndex` 首站上滚/末站下滚钳制；`resolveFlowBoundary` 四象限（deck 素材站下滚越界 → free、free 顶部上滚 → deck、free 非顶部上滚保持 free、deck 非素材站保持 deck）；`easeInOutCubic` 端点 0/1 与中点。

**验证**：`pnpm -C apps/bookstore test -- home-fullpage` 全绿。

### 步骤 3：`sectionRail.ts` 树模型纯函数（TDD，纯函数轨）

新建 `features/home/sectionRail.ts`：
- `buildTree(sections): RailNode[]`——模块 → 子内容两层（档案 5 站挂档案模块下）；
- `activeNode(sections, index): SectionId`——站索引映射当前节点。

**测试先行** 新建 `tests/unit/home-section-rail.test.ts`：树层级正确（首页/日历/素材为主节点，档案含 5 子节点）；`activeNode` 档案各站映射对应子节点；日历缺席时树收敛为 首页/档案×5/素材。

**验证**：`pnpm -C apps/bookstore test -- home-section-rail` 全绿。

### 步骤 4：`glowParticles.ts` 冲量流场扩展（TDD，纯函数轨）

扩展 `features/home/glowParticles.ts`（既有 `spawnPosition`/`createParticle`/`stepParticles`/`maxParticles` 签名不破坏，`stepParticles` 以可选参数扩展）：
- `createFlow(): { vx, vy }`；
- `impulse(flow, direction, strength): Flow`——方向 ±，强度钳制上限，对 flow 取钳制合成（非无限累加）；
- `decayFlow(flow, dt, halfLife): Flow`——指数衰减（半衰期约 0.4~0.6s，定稿以设计为准），低于阈值归零；
- `stepParticles(particles, dt, opts, flow?)`——flow 非零时在既有漂移上叠加流场速度；flow 为零/缺省时行为与现态逐位一致。

**测试先行** 扩展 `tests/unit/home-glow-particles.test.ts`：`impulse` 方向正确/强度钳制/连续注入不超限；`decayFlow` 单调衰减最终归零；`stepParticles` 叠加 flow 后位移方向与 flow 一致；flow 缺省时与现态输出一致（回归）。

**验证**：`pnpm -C apps/bookstore test -- home-glow-particles` 全绿。

### 步骤 5：`calendarDrag.ts` 拖拽纯函数（TDD，纯函数轨）

新建 `features/schedule/calendarDrag.ts`：
- `createDrag()` / `feedPointer(drag, dx): void`（横向位移累积）/ `release(drag, threshold): -1 | 0 | 1`——左拖超阈值（约 60px，注入可调）→ 下月 `1`，右拖 → 上月 `-1`，未超阈值 `0`；release 后状态归零。

**测试先行** 新建 `tests/unit/schedule-calendar-drag.test.ts`：左/右拖超阈值方向正确；阈值内 → 0；多次 feed 累积；release 后归零可复用。

**验证**：`pnpm -C apps/bookstore test -- schedule-calendar-drag` 全绿。

### 步骤 6：`features/about/parts` 五组内容组件抽取 + `/about` 复用（重构，内容轨）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。

1. 从 `app/(site)/(content)/about/page.tsx` 抽取五组组件至 `features/about/parts/`：`ProfilePart.tsx`（信息卡 `:84-119`）、`StoryPart.tsx`（设定故事 `:124-145`）、`TastePart.tsx`（喜好 `:148-168`）、`JourneyPart.tsx`（历程 `:171-174`，复用 `VineTimeline`）、`TriviaPart.tsx`（逸闻 `:177-195` + 官方外链按钮组 `:198-205`）；`SectionTitle` 一并移入 parts 共享；**文案零改动**（仅搬移，禁止二次设定）；
2. `/about/page.tsx` 改为顺序渲染五组组件，页头引文与 `(content)/layout.tsx` 框架保留，视觉与现态一致。

**测试先行** 新建 `tests/unit/about-parts.test.tsx`：五组组件各自渲染关键文案锚点（如本名/设定标题/喜好标签/历程节点/逸闻卡片/外链按钮）；`/about` 页渲染包含五组内容（顺序守卫）。

**验证**：`pnpm -C apps/bookstore test -- about-parts` 全绿；`pnpm -C apps/bookstore lint` 绿；目视 `/about` 与改前一致。

### 步骤 7：`CalendarView` immersive 变体 + `CalendarViewPage` 接线（TDD，日历轨）

1. `CalendarView.tsx` 新增可选 prop `variant?: "panel" | "immersive"`，默认 `"panel"` **DOM 与样式逐位保持现态**（后台 `/backdoor/schedule` 零影响）；immersive 变体（仅月视图分支 `:283-333`）：容器 `w-full`；DayCell 去 `rounded-md` 直角化；日期字号 `text-xs`→`text-base` 量级、摘要 `text-[11px]`→`text-sm` 量级（定稿以设计为准）；翻月按钮改为日历左右两侧竖条（`absolute inset-y-0 left-0/right-0` 高度占满、图标 + hover token 色），头部保留月份标题与「今天」；
2. 拖拽接线（仅 immersive 月视图）：网格区挂 `pointerdown/pointermove/pointerup`（被动、不 preventDefault；触屏 `touch-action: pan-y` 保留纵向滚动），横向位移喂 `calendarDrag`，`release` 超阈值调同一 `goMonth`；拖拽中超阈值置 `isDragging` 抑制日期 click；周视图分支（`:188-281`）不接拖拽、布局不变；
3. `CalendarViewPage.tsx` 传 `variant="immersive"`（容器去 `max-w-[80rem]` 限宽改全幅，`:59`），`/calendar` 路由同步新样式。

**测试先行** 扩展 `tests/unit/schedule-calendar-view.test.tsx`：`variant` 缺省渲染现 DOM（回归：头部翻月按钮、圆角类存在）；immersive 渲染左右侧全高翻月按钮、点击上抛新网格范围（mock `onRangeChange`）；模拟 pointer 拖拽超阈值触发翻月（与按钮同口径）、阈值内不触发且日期点击不受影响；周视图分支不渲染拖拽/竖条按钮。

**验证**：`pnpm -C apps/bookstore test -- schedule-calendar-view` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 8：`AssetGallery` 全幅化（素材轨）

1. `app/(site)/(content)/assets/page.tsx` 容器去 `max-w-6xl`（`:13`）改全幅（保留左右 padding）；
2. `AssetGallery.tsx` 网格断点列数扩展（`:131`，如 `xl:grid-cols-4`，定稿以设计为准）；筛选、4:5 占位、Lightbox 口径零改动。

**测试先行** 扩展/新建 `tests/unit/asset-gallery.test.tsx`：渲染网格含扩展断点类；筛选/Lightbox 既有断言回归不红。

**验证**：`pnpm -C apps/bookstore test -- asset-gallery` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 9：屏组件 `sections/`（Hero/Archive/Calendar/Assets）

新建 `features/home/sections/` 四个屏组件（每屏根节点 `h-svh`、含可被读屏定位的 `h2` 标题）：
- `HeroSection.tsx`：现 `page.tsx` 内容搬移（雾气 `.fog` 保留在 deck 层或 Hero 内以实现定稿为准；左列内容 + `ParallaxLayer` 立绘 + `LiveStatus`/`TodaySchedule` 的 `API_CONFIGURED` 守卫口径不变）；**不再渲染 `Footer floating`**，改文案块下方一行小号免责声明（token 色 `ink-dim`）；
- `ArchiveSection.tsx`：props `{ part: 1..5 }`，桌面 `grid` 左右分栏——单数屏 立绘→内容、双数屏 内容→立绘（`order` 或条件类切换）；移动端纵向（立绘上内容下、立绘高度收敛）；立绘从 `standing-01`/`standing-02`/`illustration-01` 循环选取（`pointer-events-none`、按屏懒加载）；内容侧渲染对应 `features/about/parts/*`；内容区居中收缩，桌面一屏不溢出（P2/P4 允许字号/间距收敛，不产生屏内滚动条）；P5 末尾官方外链按钮组；
- `CalendarSection.tsx`：全幅屏内渲染 `CalendarViewPage`（immersive 已接线）；`API_CONFIGURED` 为假时该站整站不注册（注册表过滤，组件内无需守卫）；
- `AssetsSection.tsx`：渲染 `AssetGallery` + 其高度自然伸展（free 模式文档流内容）+ 流式 `<Footer site />`（全站唯一 Footer）。

**测试先行** 新建 `tests/unit/home-deck-sections.test.tsx`：Hero 含文案块与立绘层、无 Footer floating；Archive 各 part 渲染对应内容组件、单双屏立绘侧类正确；Assets 含 AssetGallery 与流式 Footer。

**验证**：`pnpm -C apps/bookstore test -- home-deck-sections` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 10：`useFullpageScroll.ts` 翻页 hook（集成轨）

新建 `features/home/useFullpageScroll.ts`：
- window 级被动监听：`wheel` 经 `feedWheel` 聚合产出方向意图（**不 preventDefault**，`overflow-hidden` 天然阻断滚动）；`touchstart/touchmove/touchend` 同理；键盘 `↓/↑/PageDown/PageUp/Home/End` 映射意图；
- 状态机驱动站索引 → 直写轨道 `style.transform = translate3d(0, -index*100svh, 0)`（CSS transition 承载转场，常规约 700~900ms；不触发 React 重渲染）；reduced-motion 经 `useMediaQuery("(prefers-reduced-motion: reduce)")` 响应式订阅，为真时转场参数降级为 ≤200ms opacity 淡切，运行时切换即时生效；
- 站索引变化同步 `location.hash`（`history.replaceState`，取自注册表）；挂载时解析初始 hash 直落对应站（无转场）；
- 素材区 deck/free 模式切换（`resolveFlowBoundary`）：free 模式容器取消 `overflow-hidden`、轨道位移固定素材站，浏览器接管自然滚动；free 模式 `scroll` 监听计算滚动速度喂粒子冲量；回顶上滚回收 deck 并翻上一站；切换瞬间轨道位移与文档滚动位置对齐、死区消除抖动；
- 翻页开始派发冲量事件（回调注册或自定义事件，供 GlowParticles 消费）；弹层（Lightbox/当日详情）打开时屏蔽翻页输入（既有 `body.overflow=hidden` 滚动锁定口径扩展）；
- hydration 一致：初始不写 transform、不读 hash（SSG 直出站 0），hash 定位在挂载 effect 中执行；卸载完整清理监听与 rAF。

**测试先行** 新建 `tests/unit/home-fullpage-scroll.test.tsx`（jsdom pragma；matchMedia mock 仿 `use-media-query.test.ts`，rAF/transition 打桩）：模拟 wheel 序列站索引前进一屏且不连跳；键盘映射正确；hash 初始定位（`#archive-3` 直落）；hash 同步 `replaceState`；reduced-motion 下转场参数降级且冲量事件不派发；free/deck 模式切换边界；卸载清理不抛错。

**验证**：`pnpm -C apps/bookstore test -- home-fullpage-scroll` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 11：`FullpageDeck.tsx` + `SectionRail.tsx` + `page.tsx` 重构接线（集成轨）

1. **`features/home/FullpageDeck.tsx`**（`"use client"`）：外层 `100svh overflow-hidden` 容器 + 纵向轨道（`height: N*100svh`），按 `visibleSections(API_CONFIGURED)` 渲染站序列（Hero → Archive×5 → Calendar → Assets），挂 `useFullpageScroll`；渲染常驻 `<GlowParticles />`（fixed，步骤 12 改造）与 `<SectionRail />`；SSG 首渲染即站 0、无 transform；
2. **`features/home/SectionRail.tsx`**：`<nav aria-label="页面位置">` 固定视口右侧；竖轴细藤蔓线（CSS 渐变 token 色）+ 主节点（微光紫花圆点 + 文字）+ 档案 5 缩进子节点（树状连线）；数据 `buildTree(visibleSections(...))` 与 deck 同源；`activeNode` 高亮（子节点精确到站、档案父节点次级高亮）；节点 `<a href="#...">` 键盘可达，点击拦截调 deck 跳转（同翻页转场）；素材自然滚动区「素材」保持高亮；移动端（< 640px）收纳为仅主节点极简形态；reduced-motion 关闭脉冲/生长动效；轴体 `pointer-events-none`、仅节点可点；
3. **`app/(site)/page.tsx`** 重构为渲染 `<FullpageDeck />`（保持 Server Component 外壳，deck 为 Client 叶子）；原 100svh 封面内容全部由 HeroSection 接管。

**测试先行** 新建 `tests/unit/home-fullpage-deck.test.tsx`：首屏直出站 0（无 transform）；渲染完整站序列与常驻粒子 canvas、SectionRail；未配置 API 时站序列/指示器均无日历；SectionRail 当前站变化高亮正确、点击节点触发跳转；模拟 wheel 后指示器高亮随动。

**验证**：`pnpm -C apps/bookstore test -- home-fullpage` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore build` 绿。

### 步骤 12：`GlowParticles` fixed 常驻 + 冲量源接线（集成轨）

1. `GlowParticles.tsx` 定位类 `absolute inset-0`（`:163`）→ `fixed inset-0` 常驻视口层（z 序保持雾气之上/内容之下，全程 `pointer-events-none`、`aria-hidden`），覆盖所有模块与素材自然滚动区；脱离首页 `overflow-hidden` 根容器后由 deck 渲染；
2. 冲量接线：组件内持有 `createFlow()`，注册冲量源——`useFullpageScroll` 翻页事件（固定档位）+ free 模式滚动速度（连续喂入）；每帧 `decayFlow` 后 `stepParticles(..., flow)`；reduced-motion 为真时不注入任何冲量（流场恒零），既有降级口径（上限减半、降速 ×0.5、去明灭）不变；`document.hidden` 暂停口径不变。

**测试先行** 扩展 `tests/unit/home-glow-particles-canvas.test.tsx`：渲染为 fixed 常驻类；接收冲量事件后传入纯函数的 flow 非零（spy 断言），随后衰减归零；reduced-motion 时注入冲量事件 flow 恒零；运行时切换媒体查询即时换参；卸载清理不抛错。

**验证**：`pnpm -C apps/bookstore test -- home-glow` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 13：`NavBar` 锚点化与选中态（集成轨）

1. `NavBar.tsx` `BASE_LINKS`（`:15-20`）href 改锚点形态：主页 `/#hero`（或 `/` 首屏口径，定稿以实现为准）、档案 `/#archive-1`、素材 `/#assets`、日历 `/#calendar`（hash 取自注册表，单一事实源）；`API_CONFIGURED` 日历项缺席口径（`:19`）不变；B 站外链与 tools 项不变；
2. 选中态：首页路由下按 `location.hash` + `hashchange` 监听（或 deck 自定义事件）匹配 `navKey` 高亮（档案 P1~P5 均视为「档案」选中）；非首页路由按既有 pathname 口径（`:42-43`）；
3. 首页内点击导航项由 deck 拦截平滑翻页；其他路由为正常跳转（浏览器定位 + deck 挂载 hash 直落）；移动端菜单项同一数据源。

**测试先行** 扩展/新建 `tests/unit/nav-bar.test.tsx`：hash 变化同步选中态（`#archive-3` → 档案高亮）；非首页路由 pathname 口径回归；未配置 API 无「日历」项；移动端菜单项 href 与桌面一致。

**验证**：`pnpm -C apps/bookstore test -- nav-bar` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore build` 绿。

### 步骤 14：e2e、Spec 同步与收尾验收

1. **e2e**（SKILL: z-test）扩展 `tests/e2e/src/bookstore/site.spec.ts`：首页存在常驻粒子 canvas（fixed、pointer-events-none）与 SectionRail；wheel 模拟翻页后档案屏可见、指示器高亮移动；素材区自然滚动可见 Footer 且全站单 Footer；键盘 PageDown 翻页；`page.emulateMedia({ reducedMotion: "reduce" })` 下翻页可用、粒子 canvas 存在；`calendar.spec.ts` 增补（API 配置形态）日历屏侧竖条按钮翻月与补位格日程回归、拖拽翻月回归、移动端周视图回归；`/about` `/assets` `/calendar` 直接访问内容完整；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：
   - `docs/product/spec/site-pages.md`：首页整页滚动现态（站序列/导航锚点/指示器/粒子常驻与冲量/档案五屏/素材全幅与单 Footer、reduced-motion 降级保留口径及范围）；
   - `docs/product/spec/calendar.md`：日历 immersive 变体现态（全幅直角中字、侧翻月竖条、拖拽翻月；后台 panel 不变）；
   - `docs/design/02-page-design.md`：翻页转场/指示器/冲量参数定稿值（时长、半衰期、阈值）、档案五屏立绘选取与分栏细节；
   - `apps/bookstore/AGENTS.md`：`features/home/` 新增模块（sections/fullpage/useFullpageScroll/FullpageDeck/SectionRail/sectionRail/sections/*）、粒子冲量口径、`features/about/parts`、`CalendarView` variant、AssetGallery 全幅化记录；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；`pnpm lint && pnpm test && pnpm build`（apps/bookstore）与 e2e 全绿；本地 `aspire start` 手工走查桌面（1280×800）与移动（375×667）：一次手势一屏不连跳、素材尾部自然滚动与回收、粒子冲量上浮/下坠滞留、日历拖拽翻月、系统开启减少动态后降级生效；
4. 推送 `feat/home-visual-v4` 并提 PR 至 `prd/home-visual-v4`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：零新包。既有 `GlowParticles`/`useParallax`/`useMediaQuery`/`CalendarView`/`AssetGallery`/`VineTimeline`/`Footer` 全部复用/扩展；`GET /api/stream-plans` 契约不变；Aspire 四资源编排无新增配置。
- **并行协调**：步骤 1-8 无文件交叉，可按四轨并行 subagent（纯函数轨 1-5、内容轨 6、日历轨 7、素材轨 8）；步骤 9 依赖 6/7/8；步骤 10-13 串行集成；步骤 14 依赖全部完成。
- **风险**（对应提案 §5.2 与核对发现）：
  - **hydration 一致性**：纯静态导出——deck 首渲染必须即站 0、无 transform、无 hash，初始 hash 定位仅在挂载 effect 执行（单测覆盖 SSG 快照）；
  - **手势冲突**：日历屏横向拖拽翻月与整页纵向翻页正交；触屏必须显式 `touch-action: pan-y` 避免浏览器手势争抢；wheel 全程 passive 不 preventDefault；弹层打开时屏蔽翻页输入；
  - **deck/free 边界抖动**：scrollTop 在 0 附近振荡用死区（>2px）消除；模式切换瞬间轨道位移与文档滚动位置对齐，不得跳动；
  - **内容溢出**：P2 设定/P4 历程内容量偏大，窄半栏内以字号/间距收敛 + 历程时间轴窄栏降级单侧（复用既有移动端单侧口径）；验收线「桌面一屏不溢出、移动端不截断关键信息」；
  - **立绘素材有限**：全身立绘仅 `standing-01`/`standing-02`，氛围插画 `illustration-01`——五屏循环选取 + 尺寸/裁切差异定稿，不新造素材、不使用 promo 图充当立绘；
  - **后台零回归**：`CalendarView` 默认 `panel` 变体 DOM 逐位不变（单测回归断言），后台 `/backdoor/schedule` 不传 variant；
  - **粒子常驻改造**：`absolute`→`fixed` 后须脱离首页 `overflow-hidden` 根容器（改由 deck 渲染），否则仍被裁剪；冲量 `impulse` 钳制合成防连续叠加超限；
  - **reduced-motion 运行时切换**：effect 依赖媒体查询值——转场参数/冲量注入/指示器动效即时切换（单测覆盖），降级口径仅公开站氛围层；
  - **低端机性能**：转场仅 `transform`/`opacity` 合成层属性；流场每帧一次向量加法；粒子数上限/hidden 暂停口径不变；无 `filter: blur` 逐帧开销；
  - **token 取色**：指示器/转场/日历新样式仅用 `@theme` token 色，禁硬编码；Canvas 取色沿用 `getComputedStyle`（jsdom 单测需打桩）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-01-home-visual-v4-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-09-01-home-visual-v4-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]
- 设计文档：[[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
- 产品 Spec（现态）：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`
- 契约（不变）：`contract/stream-plans.openapi.yaml`
- 参考先例：[[2026-08-31-home-visual-v3-impl-plan.md]]（上一迭代实现方案，格式与本方案一致）
