---
description: 弹幕看板视觉优化实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（纯前端单一开发分支 feat/danmaku-board-visual-polish：信息流插入/平移动效、弹幕合并开关默认关闭、SC 留言可复制、弹幕条目船型 0.5% 透明度背景；TDD 步骤、验证与验收）
type: Permanent
---

# 弹幕看板视觉优化 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-19-danmaku-board-visual-polish-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-19-danmaku-board-visual-polish-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-board-visual-polish`
**开发分支**: `feat/danmaku-board-visual-polish`（自需求总分支切出，**唯一开发分支**）
**版本**: v1.0（2026-08-19）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。本期为纯前端展示层改造，**无契约/服务端/编排变更**。前提事实（已在需求总分支核对代码现态）：

- `apps/bookstore/features/danmaku/components/FeedSection.tsx:62-64`：`rows = mergeDanmaku(events)` 恒折叠、`folded = rows.length < events.length`；`:66-73` `useVirtualizer`（`getItemKey` 用 `event.eventId`、`estimateSize` 72、`overscan` 8）；`:151-166` 虚拟行 wrapper 绝对定位 `style={{ transform: translateY(start) }}` + `ref={virtualizer.measureElement}`——平移 transition 与入场动画的挂载点；
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx:221-247`：`handleStreamEvent` 是 SSE 到达唯一入口（gift 低价过滤 → prepend 分发 → SC/上船 New 标记），freshIds 在此记录；`:107-111` `minPrice` state 以 `useState(() => loadGiftMinPrice())` 初始化——合并开关沿用同一初始化口径；`:422-447` 各栏 `headerExtra` 工具区（连接状态提示 + `GiftFilterControl`（仅礼物栏）+「配置栏位」按钮）为「弹幕合并」开关落点，全屏模式（`app/backdoor/(dashboard)/danmaku/page.tsx:40-63`）复用同一 `FeedColumn` 栏头，开关天然全屏生效；
- `apps/bookstore/features/danmaku/components/FeedColumn.tsx:114-129`：逐 section 渲染 `FeedSection` 并透传 props——`mergeEnabled`/`freshIds` 在此透传；
- `apps/bookstore/features/danmaku/components/SuperChatItem.tsx:28-30`：容器 `cursor-pointer select-none`（`onToggleRead` 存在时）；`:47-67` 留言气泡 `<p>`（含罗马音行 `:64-66`）——去 `select-none`、气泡加 `select-text` + dblclick 隔离；
- `apps/bookstore/features/danmaku/components/DanmakuItem.tsx:26`：根节点 `flex gap-2.5 px-3 py-2`，无背景类——tint 类与 `rounded-md` 在此拼接；`format.ts:36-46` 既有 `guardLevelTone`（3→eye / 2→flower / 1→crimson）确立船型色 token 口径；
- `apps/bookstore/features/danmaku/giftMinPrice.ts:21-42`：`getStorage`（SSR 回退 null）+ `JSON.parse` try/catch + 损坏回退默认的存储口径，`mergeEnabled.ts` 仿此（无需 Zod——boolean 类型判断即可，亦无需 useSyncExternalStore 订阅，开关仅看板持有）；
- `apps/bookstore/app/globals.css:41-42`：`--animate-*` 动画 token 定义于 `@theme`（`--animate-rise`/`--animate-pulse`），`--animate-danmaku-enter` 仿此；`:55,106,124` `@keyframes` 集中定义；`:29-32` `--color-flower/eye/crimson` token 已存在；
- 测试基底：`tests/unit/danmaku-feed-section.test.tsx:72-128`「FeedSection 弹幕折叠」describe（恒折叠断言 ×3/×2/折叠自动填充，默认关闭后需显式传 `mergeEnabled`）；`danmaku-items.test.tsx:87-96`（DanmakuItem 计数）、`:245-313`（GuardItem 三档船型断言模式可仿）；`danmaku-dashboard.test.tsx`（看板接入，无折叠断言）；`danmaku-merge.test.ts`（`mergeDanmaku` 纯函数，零改动）；e2e `tests/e2e/src/backdoor/danmaku.spec.ts` 无折叠/合并断言，零适配。

整体顺序：**切开发分支 → 前端实现（TDD，单一 subagent）→ 回归测试 → 收尾验收**。纯前端单应用改造，一个实现 subagent 顺序完成四个功能点。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 信息流插入 | SSE prepend 后虚拟行 transform 瞬变，无视觉反馈 | fresh 行入场动画（淡入+下落 200ms），非滚动中既有行 transform 平移过渡；历史首屏/分页不动画；`prefers-reduced-motion` 全降级 |
| 弹幕合并 | `mergeDanmaku` 恒开启 | 栏头工具区「弹幕合并」开关（`role="switch"`），默认关闭逐条展示；localStorage `danmaku-backdoor.merge-danmaku` 持久化，损坏回退关闭；切换即时生效不重检索 |
| SC 留言 | 容器 `select-none`，留言不可选中 | 气泡 `select-text cursor-text` 可拖选复制；气泡 dblclick 隔离不触发已读切换；气泡外双击已读不变 |
| 弹幕条目背景 | 无发送者身份区分 | `guardDanmakuTint(sender.guardLevel)`：3/2/1 → eye/flower/crimson 0.5% 透明度背景；其余无背景 |
| 测试 | 三层测试全绿 | 增量：mergeEnabled 存取、FeedSection 合并分支/动效类、SuperChatItem 选中隔离、DanmakuItem tint、看板开关接入；既有折叠用例适配默认关闭口径；API/e2e 仅回归 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-board-visual-polish`；
- 开发工作全部在**唯一开发分支** `feat/danmaku-board-visual-polish` 上进行（自 `prd/danmaku-board-visual-polish` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-board-visual-polish` 切出 `feat/danmaku-board-visual-polish`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-board-visual-polish`。

### 步骤 1：前端实现（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`。注意 `apps/bookstore/AGENTS.md` 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。全程 TDD：先失败测试再实现。按四个功能点小步提交：

1. **F2 弹幕合并开关**（先行，测试适配面最大）：
   - 新增 `features/danmaku/mergeEnabled.ts`：仿 `giftMinPrice.ts:21-42` 口径——`MERGE_ENABLED_STORAGE_KEY = "danmaku-backdoor.merge-danmaku"`；`loadMergeEnabled(): boolean`（SSR/无存储/非法值恒回退 `false`，`JSON.parse` try/catch + `typeof === "boolean"` 校验）；`saveMergeEnabled(v: boolean)`（写 JSON boolean）；
   - `DanmakuDashboard.tsx`：`const [mergeEnabled, setMergeEnabled] = useState(() => loadMergeEnabled())`（沿用 `:107` minPrice 初始化口径）；`handleMergeEnabledChange` = `saveMergeEnabled` + set state（不触发任何检索）；各栏 `headerExtra` 工具区（`:434` GiftFilterControl 之前）渲染开关：`<button type="button" role="switch" aria-checked={mergeEnabled} aria-label="弹幕合并">` + 标签文本「弹幕合并」，视觉沿用既有按钮 token（`border-vine/50 text-ink-dim`，开启态 `border-flower text-ink`），键盘可操作（button 原生语义）；
   - `FeedColumn.tsx`：`FeedColumnProps`/`FeedSectionData` 增 `mergeEnabled`/`freshIds` 透传字段；
   - `FeedSection.tsx:62-64`：`rows = mergeEnabled ? mergeDanmaku(events) : events.map((event) => ({ event, count: 1 }))`（`useMemo` 依赖加 `mergeEnabled`）；`folded = mergeEnabled && rows.length < events.length`——关闭时「折叠自动填充」分支（`:84-87`）不触发，短列表维持手动「加载更多」口径；`mergeEnabled` prop 缺省 `false`；
   - 测试适配：`danmaku-feed-section.test.tsx:72-128`「弹幕折叠」describe 三个用例显式传 `mergeEnabled`（折叠行为断言不变）；新增 `mergeEnabled` 缺省/false 时逐条渲染无「×N」用例；新增 `danmaku-merge-enabled.test.ts`：默认 false、存取往返、`"1"`/`"yes"`/坏 JSON 回退 false；`danmaku-merge.test.ts` 零改动；
2. **F1 插入/平移动效**：
   - `globals.css`：`@theme` 增 `--animate-danmaku-enter: danmaku-enter 200ms ease-out both;`（仿 `:41-42`）；新增 `@keyframes danmaku-enter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`（仅 transform/opacity）；
   - `DanmakuDashboard.tsx`：新增 `freshIds` state（`ReadonlySet<string>`）；`handleStreamEvent` prepend 成功（事件实际插入至少一个分节）时把 `event.eventId` 加入 freshIds，单一 `setTimeout` 300ms 计时器（ref 持有）批量清除整批；低价 gift 被丢弃/重复 eventId 去重跳过时不标记；清除逻辑写入 ref 避免闭包陈旧；
   - `FeedSection.tsx`：虚拟行 wrapper（`:155-165`）加条件类——`virtualizer.isScrolling` 时 `transition-none`，否则 `transition-transform duration-200 motion-reduce:transition-none`；wrapper 内包一层 `<div className={freshIds.has(row.event.eventId) ? "animate-danmaku-enter motion-reduce:animate-none" : undefined}>`（动画类挂内层，不干扰被 `measureElement` 测量的 wrapper；translateY(-8px) 不改行高）；`freshIds` prop 缺省空 Set；
   - 测试：`danmaku-feed-section.test.tsx` 新增——freshId 行带 `animate-danmaku-enter` 类、非 fresh 行不带、wrapper 带 `transition-transform` 与 `motion-reduce:transition-none`；`danmaku-dashboard.test.tsx` 新增——SSE 事件到达后对应行带入场类（fake timers 断言 300ms 后类消失）、历史首屏检索结果不带入场类；
3. **F3 SC 留言可复制**：
   - `SuperChatItem.tsx:28-30`：容器去 `select-none`（保留 `cursor-pointer` 与 `onDoubleClick`/`title`）；`:47-67` 留言气泡 `<p>` 加 `select-text cursor-text` 与 `onDoubleClick={(e) => e.stopPropagation()}`（无论是否 `onToggleRead` 均挂——member 下无副作用）；
   - 测试：`danmaku-items.test.tsx` 新增——气泡带 `select-text`；气泡上 `fireEvent.doubleClick` 不触发 `onToggleRead`；气泡外（如条目容器）双击触发 `onToggleRead`；
4. **F4 弹幕条目船型淡色背景**：
   - `format.ts` 新增纯函数 `guardDanmakuTint(level: number | null | undefined): string | null`——3→`bg-eye/[0.5%]`、2→`bg-flower/[0.5%]`、1→`bg-crimson/[0.5%]`、其余 null；类名字面量全量书写供 Tailwind 扫描；**构建验证 0.5% 斜杠任意值被 Tailwind v4 正确生成**，若未生成则回退 `bg-[color-mix(in_oklab,var(--color-eye)_0.5%,transparent)]`（对齐 `globals.css:51` 既有 color-mix 写法），`guardDanmakuTint` 签名与测试断言同步调整；
   - `DanmakuItem.tsx:26`：根节点拼接 `guardDanmakuTint(event.sender.guardLevel)` 与 `rounded-md`（有 tint 时）；合并代表行按代表事件（末次出现者）等级渲染，天然满足；
   - 测试：`danmaku-format.test.ts` 新增 `guardDanmakuTint` 3/2/1/null/0/99 断言；`danmaku-items.test.tsx` 新增 DanmakuItem 三档 tint 类与无等级/未知等级无 tint 断言；
5. 单测收尾：`danmaku-dashboard.test.tsx` 新增——默认合并关闭（重复弹幕逐条渲染无「×N」）、开关切换即时折叠且 `localStorage` 写入 `true`、localStorage 预置 `true` 时首屏折叠；
6. 视觉约束：仅用 `@theme` token 色（禁硬编码色值）；动效仅 transform/opacity、≤200ms、无弹跳/光效；遵循 `prefers-reduced-motion`（全部动效走 `motion-reduce:` 变体）；无未上线功能占位。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；构建产物 CSS 中确认 `danmaku-enter` keyframes 与 0.5% tint 类已生成。

### 步骤 2：回归测试（subagent，SKILL: z-test）

无契约/接口变更，无新增 e2e 用例：

1. e2e `tests/e2e/src/backdoor/danmaku.spec.ts` 全量回归（无折叠断言，零适配）；重点确认 `danmaku-nav-columns`/`danmaku-scroll-anchor` 用例在默认不合并口径下仍绿（夹具弹幕内容均不重复，折叠与否不影响）；
2. `tests/api` 全量回归（零变更，保持绿即可）。

**验证**：Aspire 编排下 `tests/e2e` 与 `tests/api` 全量通过。

### 步骤 3：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`（插入/平移动效、合并开关默认关闭与持久化 key、SC 可复制、船型淡色背景现态）与 `docs/engineering/spec/frontend-bookstore.md`（mergeEnabled/guardDanmakuTint/动效机制现态）；PRD 与提案为时点文档，不改原文；
2. 更新 `apps/bookstore/AGENTS.md` 弹幕看板约定段（`mergeEnabled.ts`、动效、开关、tint 口径）；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；
4. 推送 `feat/danmaku-board-visual-polish` 并提 PR 至 `prd/danmaku-board-visual-polish`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：弹幕看板一期/二期/礼物筛选既有实现（虚拟化、锚定、SSE 分发、存储口径）为改造基底；`@tanstack/react-virtual` 既有版本（`isScrolling` 标志驱动 transition 开关）；无新增依赖、无契约/服务端/编排变更；
- **并行协调**：纯前端单一开发分支，单一实现 subagent 按 F2 → F1 → F3 → F4 顺序小步提交（F2 先行：测试适配面最大且合并分支是 freshIds 动画的列表语义基础）；回归测试依赖前端就绪；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 入场动画类挂被 `measureElement` 测量的节点导致行高测量抖动——动画类挂内层 wrapper（translateY(-8px) 不改高度），实现时以单测 + 手动滚动验证（步骤 1.2）；
  - 高密度 SSE 连续插入动画叠加失真——freshIds 单计时器批量清除，新批次直接替换进行中动画（步骤 1.2）；
  - 分页 append 复用 DOM 节点误播动画——动画由 freshIds 驱动而非 mount 驱动，`getItemKey` 用 eventId（既有），append 事件不进 freshIds（步骤 1.2）；
  - Tailwind v4 不生成 `bg-eye/[0.5%]` 任意透明度——构建产物验证，回退 `bg-[color-mix(...)]`（步骤 1.4）；
  - 既有折叠单测在默认关闭口径下变红——「弹幕折叠」describe 显式传 `mergeEnabled`，断言零改动（步骤 1.1）；
  - 开关状态 SSR/首帧闪烁——沿用 `giftMinPrice` 的 `useState` 初始化既有口径，不新增机制（提案 §6.2 已接受）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-19-danmaku-board-visual-polish-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-19-danmaku-board-visual-polish-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 礼物筛选实现方案（最近邻口径参考）：[[2026-08-17-danmaku-gift-min-price-impl-plan.md]]
- 既有契约：`contract/live-events.openapi.yaml`（本期零变更）
