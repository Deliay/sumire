---
description: 首页展示优化实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/home-display-polish，唯一开发分支 feat/home-display-polish。纯前端 + 构建期内容变更：useFullpageScroll 触摸/滚轮边界交接翻页（touchstart 记录可滚动容器引用、touchmove/wheel 逐次判边界后交还 turn，保持被动监听）、日历站与独立日历页顶部留位 64px NavBar、NavBar 移动端默认雾化（max-md 条件类）、assets.yaml/profile.yaml 按萌娘百科与 B 站官方信息核对更新；TDD 单测先行，上线 PR 内同步 site-pages/calendar/frontend-bookstore 三份 spec。
type: Permanent
---

# 首页展示优化实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-14-home-display-polish-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-14-home-display-polish-proposal.md]]（v1.0）
**需求总分支**: `prd/home-display-polish`（需求总 PR：<https://github.com/Deliay/sumire/pull/130>）
**开发分支**: `feat/home-display-polish`（自需求总分支切出，**唯一开发分支**，实现/测试/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-14）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD：手势边界交接先补失败用例再实现。纯前端 + 构建期 YAML/静态素材变更：无契约、无后端、无编排变更；e2e 不新增 spec 文件（提案 §8.2：移动端真实触摸交接以手工验证补充，jsdom 无法模拟原生滚动惯性）。

**前提事实**（已在需求总分支 `prd/home-display-polish` 核对代码现态，commit a4efa82）：

- `apps/bookstore/features/home/useFullpageScroll.ts`（471 行）现态：`isInsideScrollable`（`:336-345`）命中 `[data-fullpage-scrollable]` 且 `scrollHeight > clientHeight + 1` 即豁免；`onTouchStart`（`:358-367`）命中可滚动容器时 `touchStartRef.current = null` 整段豁免，`onTouchMove`（`:368-379`）因 `touchStartRef` 为 null 直接 return——**只看起点、不看边界、中途不重估**，即 F1 根因；`onWheel`（`:349-357`）同理 `return` 豁免。监听全部 `{ passive: true }`（`:447-450`），`turn`（`:222-247`）/free 回收 `reclaimToDeck`（`:209-220`）为既有边界交接先例。
- `apps/bookstore/features/home/fullpage.ts`（150 行）纯函数现态：`feedWheel`/`feedTouch` 阈值 `WHEEL_THRESHOLD=48`/`TOUCH_THRESHOLD=50`、冷却 `COOLDOWN=400`、`GESTURE_TIMEOUT=150`；方向约定 `dy>0 → 1（上一站）`、`accum>0 → -1（下一站）`；`nextIndex` 钳制。边界判定可在 hook 内联实现，无需扩展纯函数（保持最小改动）。
- `apps/bookstore/tests/unit/home-fullpage-scroll.test.tsx`（621 行）现态：Harness 以 `Object.defineProperty` 注入 `clientHeight`/`scrollHeight` 模拟可滚动容器（`:427-457` 可滚动列内不翻页、`:459-484` 非溢出不豁免照常翻页），另有 wheel/键盘/free 模式/日历拖拽无关的 21 个既有用例。新用例沿用同范式，注入 `scrollTop` 即可表达触底/触顶；**既有两例在新逻辑下语义不变**（未触底不翻页、非溢出不豁免），保持绿即回归保障。
- `apps/bookstore/features/home/sections/CalendarSection.tsx:10`：section 挂 `data-fullpage-scrollable`，`px-4 py-3 lg:px-6`（顶部仅 12px）。
- `apps/bookstore/features/schedule/CalendarViewPage.tsx:59`：非 compact 形态 `mx-auto w-full px-5 py-14 lg:px-10`（顶部 56px < NavBar 64px）；compact（deck 内）分支不加 padding，间距由 `CalendarSection` 控制。
- `apps/bookstore/components/NavBar.tsx:143-148`：`scrolled || open` 时 `bg-night/85 shadow-[0_1px_0_0_var(--color-vine)] backdrop-blur-md`，默认 `bg-transparent`；nav 高 `h-16`（`:150`）；桌面列表 `md:flex`（`:160`）、移动端菜单 `md:hidden`（`:202`），断点分化即 `md`。
- `apps/bookstore/tests/unit/nav-bar.test.tsx`（227 行）现态：mock `@/features/backdoor/api`（`configured`）与 `next/navigation`（`mockPathname`），`beforeEach` 置 `window.scrollY = 0`；新增类名断言用例无需新设施。
- `apps/bookstore/content/assets.yaml` 现态 5 条（standing-01/02、illustration-01、promo×2），schema 字段 id/title/category/file/width/height/note；`content/profile.yaml` 93 行。`package.json`：`pnpm thumbnails`（`tsx scripts/generate-thumbnails.ts`），`pnpm build` 前置 `pnpm thumbnails && tsx scripts/generate-original-webp.ts`——**新增原图除缩略图外还须生成 original webp**（`assetOriginalWebpUrl` 引用，见 `apps/bookstore/AGENTS.md`）。
- 文档同步面：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`、`docs/engineering/spec/frontend-bookstore.md` 均存在，实现 PR 内同步；`frontend-bookstore.md` 46-53 行「首页一屏封面页」章节已过期（提案 §5.2 实现点 6 要求顺带修正）。根 `AGENTS.md` 与 `apps/bookstore/AGENTS.md` 无结构/约定变更需求（手势内部实现细节，**但** `apps/bookstore/AGENTS.md` 首页氛围动效约定中 `useFullpageScroll.ts` 的「触摸起始位于可滚动列内即豁免」描述将过期，需在同一 PR 内同步该句口径）。

整体顺序（**串行**，唯一开发分支 `feat/home-display-polish`）：
**切开发分支 → F1 单测先行（红）→ F1 实现（绿）→ F2/F3 单测 + 实现 → F4 内容核对更新 → spec/AGENTS.md 同步 + 收尾验收 → PR 回合需求总分支**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 触摸豁免粒度 | `onTouchStart` 命中可滚动容器即置 `touchStartRef=null`，整段手势豁免 | touchstart 记录起始位置 + 容器引用（`touchScrollableRef`）；touchmove 逐次判边界：触底续滑/触顶续滑交还 `feedTouch`/`turn()`，未到边界 return（原生滚动） |
| 滚轮豁免 | `onWheel` 命中可滚动容器即 return | 命中时判边界：触底且 `deltaY>0` / 触顶且 `deltaY<0` 走既有 `feedWheel` 翻页，否则 return |
| 边界容差 | 溢出判断 `scrollHeight > clientHeight + 1` | 触底 `scrollTop + clientHeight >= scrollHeight - 2`、触顶 `scrollTop <= 2`（与既有 `BOUNDARY_DEADZONE=2` 口径一致） |
| 日历站顶部间距 | `py-3`（12px），与 64px fixed NavBar 重叠 | `pb-3 pt-20`（80px = 64px + 16px 余量），移动端/桌面端统一 |
| `/calendar` 页顶部间距 | `py-14`（56px） | `pb-14 pt-28`（112px），与 `/about` 独立页 `pt-28` 口径一致 |
| NavBar 默认态 | 全端 `bg-transparent` | 移动端默认雾化：`max-md:bg-night/85 max-md:backdrop-blur-md max-md:shadow-[0_1px_0_0_var(--color-vine)]`，桌面端 `md:` 起保持透明；滚动/展开态类名不变 |
| 素材库 | 5 条 | 按萌娘百科 + B 站官方公开信息核对增补，原图入 `public/assets/original/`，缩略图 + original webp 生成 |
| 档案 | profile.yaml 93 行 | 同上信息源核对，差异项更新、无差异记录结论；里程碑按时间序追加 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/home-display-polish`；
- 开发工作（实现 + 单测 + 内容更新 + spec 同步）在**唯一开发分支** `feat/home-display-polish` 上进行（自 `prd/home-display-polish` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/home-display-polish` 切出 `feat/home-display-polish` 并推送。开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`。

**验证**：`git branch --show-current` 为 `feat/home-display-polish`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：F1 单测先行（apps/bookstore/tests/unit/home-fullpage-scroll.test.tsx，红）

沿用既有 Harness 与 `Object.defineProperty` 注入范式，新增 describe「可滚动站边界交接翻页」，用例逐条对应提案 §8.1：

1. 容器已触底（`scrollHeight=1000`、`clientHeight=100`、`scrollTop=900`），触摸起点在容器内继续下滑（`clientY` 300→100，位移超 `TOUCH_THRESHOLD`）：翻下一页（index 0→1）；
2. 容器已触顶（`scrollTop=0`）继续上滑（`clientY` 100→300）：先 `goTo` 或 wheel 翻到 index 1 后，触顶续上滑翻回 index 0；
3. 触底交接后同一手势继续派发 touchmove：只翻一页（`fired` 锁定 + 冷却 + 容器引用清除生效）；
4. wheel：指针在滚动列内且列触底（`scrollTop=900`），`deltaY>0` 翻下一页；列触顶（`scrollTop=0`），`deltaY<0` 翻上一页；
5. 回归锁定：既有用例「触摸起始位于实际可滚动内容列内不触发整页翻页」（`:427-457`，容器 `scrollTop` 默认 0、下滑方向、未触底）保持绿——证明未到边界不误翻；「非溢出滚动标记不豁免」（`:459-484`）保持绿；
6. 既有全部用例不动仍绿（含 free 模式 deck/free 边界与回收用例）。

先运行确认新增用例 1-4 失败（现逻辑整段豁免不翻页）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/home-fullpage-scroll.test.tsx`——新增用例红、既有用例全绿。

### 步骤 2：F1 实现（apps/bookstore/features/home/useFullpageScroll.ts，绿）

1. 新增 `touchScrollableRef = useRef<Element | null>(null)`；将 `isInsideScrollable` 重构为返回命中容器元素的 `findScrollableContainer(target): Element | null`（判定逻辑不变：closest + overflowY + `scrollHeight > clientHeight + 1`），布尔需求处自行判空；
2. `onTouchStart`：命中容器时**不再置 null**，改为 `touchScrollableRef.current = el` 并照常记录 `touchStartRef`（起始 y + 时间戳）；未命中时 `touchScrollableRef.current = null`（现状）；
3. `onTouchMove` 开头新增分支：`touchScrollableRef.current` 存在时先取容器计算边界——
   - 触底（`scrollTop + clientHeight >= scrollHeight - 2`）且手势向下（`currentY < startY`）→ 交还既有 `feedTouch(gestureRef.current, start, current, now)`，产出意图则 `turn()` 并 `touchScrollableRef.current = null`（同手势不连翻，冷却由 `feedTouch` 保证）；
   - 触顶（`scrollTop <= 2`）且手势向上（`currentY > startY`）→ 同上翻上一站；
   - 否则 `return`（原生滚动，现状）；
4. `onTouchEnd` 增加 `touchScrollableRef.current = null` 清理；同步补 `touchcancel` 监听清理（既有未监听，一并补上防悬挂引用）；
5. `onWheel`：`isInsideScrollable(e.target)` 改为取容器 `el`，命中时判边界——触底且 `normalizeDeltaY(...) > 0` / 触顶且 `< 0` 时不 return、走既有 `feedWheel` 翻页链路；否则 return（现状）；
6. 全程保持 `{ passive: true }`、不 `preventDefault`；**不引入 `overscroll-behavior`**（提案列为按需项：jsdom 无法验证惯性叠加，先不引入，若实现后真机验证出现回弹链叠加再以一行 CSS 追加并在 PR 说明）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/home-fullpage-scroll.test.tsx tests/unit/home-fullpage.test.ts tests/unit/schedule-calendar-drag.test.ts` 全绿（步骤 1 新用例转绿 + 日历拖拽纯函数零回归）。

### 步骤 3：F2/F3 单测 + 实现（日历间距、NavBar 雾化）

1. **单测先行（红）**：
   - `nav-bar.test.tsx` 新增用例：未滚动（`scrollY=0`）、菜单未展开时 header 类名含 `max-md:bg-night/85`、`max-md:backdrop-blur-md`，且默认分支不再是无条件 `bg-transparent`；模拟滚动（`window.scrollY = 100` + 派发 scroll 事件）后含既有 `bg-night/85 backdrop-blur-md`（回归）；展开菜单态类名不变（回归）；
   - `schedule-calendar-view.test.tsx`（或既有日历测试文件，按实际断言风格）新增类名断言：非 compact 形态容器含 `pt-28`；`home-deck-sections.test.tsx` 或新建断言语境下 `CalendarSection` section 含 `pt-20`（取与既有文件组织最简的一种，若既有文件无组件渲染设施则并入 `schedule-calendar-view.test.tsx` 渲染 `CalendarSection`）；
2. **实现（绿）**：
   - `CalendarSection.tsx:10`：`px-4 py-3 lg:px-6` → `px-4 pb-3 pt-20 lg:px-6`；
   - `CalendarViewPage.tsx:59`：`px-5 py-14 lg:px-10` → `px-5 pb-14 pt-28 lg:px-10`（仅非 compact 分支，compact 不动）；
   - `NavBar.tsx:143-148`：默认分支 `bg-transparent` → `bg-night/85 shadow-[0_1px_0_0_var(--color-vine)] backdrop-blur-md md:bg-transparent md:shadow-none md:backdrop-blur-none`（移动端默认雾化、桌面端保持透明；滚动/展开分支类名不变）；
3. 纯类名调整，不动布局结构与断点体系。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿（含新用例转绿、既有 nav-bar 17 用例与日历用例零回归）。

### 步骤 4：F4 内容核对与更新（content/ + public/assets/）

1. 访问官方信息源并核对：萌娘百科条目（`https://zh.moegirl.org.cn/枝堇`）、B 站个人空间/动态（`https://space.bilibili.com/1150976664`）；**不可达时以最近一次可访问的官方信息为准并在 PR 中说明，不编造内容**（PRD §3.4）；
2. `content/profile.yaml`：逐字段核对 name/race/likes/games/milestones/anecdotes 等与官方口径差异，补新修错；里程碑按时间序追加；schema 不扩展（提案 §4），无法表达的字段记录于 PR 说明；
3. `content/assets.yaml`：新增官方公开素材条目（id 语义化、category 沿用 standing/illustration/promo、字段完整 id/title/category/file/width/height/note），原图入 `public/assets/original/`；图片尺寸/格式异常不入库；
4. 运行 `pnpm -C apps/bookstore thumbnails` 生成缩略图，并运行 `pnpm -C apps/bookstore exec tsx scripts/generate-original-webp.ts`（或经 `pnpm build` 前置）生成 original webp——新增原图缺 webp 会致立绘/素材 404；
5. 内容核对结论（更新字段、新增素材、信息源链接、无差异项）写入 PR 描述，保证可溯源；遵守「以官方公开信息为准，禁止二次设定」。

**验证**：`pnpm -C apps/bookstore test` 全绿（`content.test.ts` Zod 校验与 `asset-gallery.test.tsx` 渲染覆盖新增条目）；`pnpm -C apps/bookstore build` 成功且缩略图/webp 产物齐；本地 `pnpm dev` 目检首页素材架与 `/assets` 正常展示新素材。

### 步骤 5：Spec/AGENTS.md 同步与收尾验收

1. `docs/product/spec/site-pages.md`：首页 deck 小节补「可滚动站触底/触顶交接翻页」现态；导航小节补移动端默认雾化；日历站/素材站描述随 F2/F4 更新；
2. `docs/product/spec/calendar.md`：日历页导航留位现态（deck 站 `pt-20`、独立页 `pt-28`）；
3. `docs/engineering/spec/frontend-bookstore.md`：手势链路补边界交接机制（touchstart 记录容器、touchmove/wheel 边界判定交还 turn）；顺带修正过期的「首页一屏封面页」章节（46-53 行，提案 §5.2 实现点 6）；
4. `apps/bookstore/AGENTS.md` 首页氛围动效约定小节：`useFullpageScroll.ts` 描述中「触摸起始位于 `[data-fullpage-scrollable]` 内且实际可滚动时方不喂入手势聚合」更新为「记录容器引用、逐次判边界，触底/触顶同向越界交接翻页」口径（该文件属项目约定文档，行为变更须同 PR 同步）；
5. 核对 PRD §1.3 / §3.2 验收标准与提案 §10 全量通过；移动端真实触摸交接以真机/模拟器手工验证补充并在 PR 中记录；
6. 推送 `feat/home-display-polish`，提 PR 回合 `prd/home-display-polish`（需求总 PR #130 随之更新）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；spec 三份 + AGENTS.md 同步完成；PR 描述含 F4 核对结论与信息源链接。

## 4. 依赖与风险

- **依赖**：萌娘百科条目、B 站空间/动态可访问（F4 信息源；不可达时以最近可访问官方信息为准并在 PR 说明）；`pnpm thumbnails` / `generate-original-webp.ts` 既有脚本；
- **风险**：触底瞬间原生惯性滚动与翻页 transform 叠加造成视觉跳动——交接后容器引用清除 + `feedTouch`/`feedWheel` 的 `fired` 锁定 + `COOLDOWN=400ms` 三重约束单次手势只翻一页；真机验证若仍叠加，追加 `overscroll-behavior: contain`（CSS 一行，不破坏被动监听）；
- **风险**：日历站内拖拽（`schedule-calendar-drag`）起点也在容器内被误翻——边界分支仅在容器到界且位移超阈值时触发，日历拖拽短位移不受影响；步骤 2 验证含 `schedule-calendar-drag.test.ts` 回归；
- **风险**：触控板惯性滚动触底后持续派发 wheel 连翻——既有 `COOLDOWN` 已覆盖，与不可滚站行为一致；
- **风险**：`findScrollableContainer` 重构改变 `isInsideScrollable` 语义——判定逻辑逐行保留（closest + overflowY + 溢出 +1 容差），仅返回值从 boolean 改为 Element|null，既有用例 `:427-484` 锁定语义不变；
- **风险**：移动端首屏 hero 视觉变化（NavBar 默认不再透明）——PRD 已明确为需求，桌面端不受影响（`md:` 分支保持透明）；
- **风险**：F4 新增素材缺 original webp 致 404——步骤 4 第 4 条显式生成并列入验证。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-14-home-display-polish-prd.md]]
- 技术提案：[[../proposals/2026-09-14-home-display-polish-proposal.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`、`../../product/spec/calendar.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 开发规范：[[../frontend-rules.md]]
