---
description: 弹幕看板「SC/上船 悬停胶囊栏」实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（含返工两轮的 F4 定位增强）。唯一开发分支 feat/danmaku-hover-bar，契约新增 SC time 可选字段 + 前端 hoverTopBar 纯函数 / useHoverPills 胶囊集合 / HoverTopBar 组件 / FeedSection 按 eventId 定位与一次性闪光 / FeedColumn 与 DanmakuDashboard 接线，全部单测 TDD 落地；DB/编排零变更。
type: Permanent
---

# 弹幕看板「SC/上船 悬停胶囊栏」实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-23-danmaku-hover-bar-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-23-danmaku-hover-bar-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-hover-bar`
**开发分支**: `feat/danmaku-hover-bar`（自需求总分支切出，**唯一开发分支**，全部实现与测试同在此分支）
**版本**: v1.0（2026-08-23，含返工并入：目标不在已加载列表时滚动定位 + F4 点击定位闪光）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `servers/api/src/liveEvents/normalize.ts:170-204`：`normalizeSuperChat` 已透传 `content`/`price`/`scColors`（`background_color_start/end`、`message_font_color`），eventId `sc:{id}`；**未透传 `data.time`**（SC 悬停时长，秒）。`asNumber`（`:54-56`）`typeof number && isFinite` 返回 number|undefined，可复用；
- `contract/live-events.openapi.yaml:229-324`：`LiveEvent` schema（`type`/`eventId`/`occurredAt`/`sender`/`content?`/`contentRomaji?`/`emote?`/`price?`/`scColors?`/`gift?`/`guard?`/`read`）。`price` 在 `:318`、`scColors` 在 `:321-324`（可选、仅 super_chat 携带）。`time` 字段需在其后新增 `time?: integer`；
- `apps/bookstore/features/danmaku/types.ts:31-64`：`ScColorsSchema`（`:31-35`）+ `LiveEventSchema`（`:37-64`）。`price` 在 `:50`、`scColors` 在 `:51`；需在其后新增 `time: z.number().optional()`；
- `apps/bookstore/features/danmaku/format.ts:18-23`：`guardLevelName(level)`（3/2/1→舰长/提督/总督，未知 null）；`:36-46` `guardLevelTone(level)`（3→`bg-eye/70,bg-eye/25,text-eye,bg-eye/10`、1→crimson 系、2→flower 系）；`formatPrice`（`:26-29`）；
- `apps/bookstore/features/danmaku/components/FeedColumn.tsx:49-93`：`FeedColumn`（栏容器，栏头在 `:64-69`、小节在 `:71-90` `sections.map` → `FeedSection`）。**悬停栏将挂载于栏头与 `sections.map` 之间**（栏内容区顶部，即 `:70` configPanel 之后、`:71` 小节容器之前）；入参在 `:26-42`；
- `apps/bookstore/features/danmaku/components/FeedSection.tsx`：`useVirtualizer`（`:75-82`，`count` 为 `rows.length`，`getItemKey = rows[index].event.eventId ?? index` 于 `:80`）；`renderItem`（`:108-122`）按 `event.type` 分发 `SuperChatItem`/`GuardItem`；虚拟行 wrapper（`:164-189`）`measureElement`（`:168`）、transform 平移过渡（`:172-176`）、内层挂 `animate-danmaku-enter`（`:181-185`）——**闪光复用内层方案，不改行高**；滚动触底加载 `maybeLoadMore/onLoadMore`（`:89-106`，`LOAD_MORE_OFFSET_PX=200` 于 `:14`）；
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx`：`:108-113` `columns = resolveColumns(...)`；`:115-127` 状态（`eventsBySection`/`loadedSections`/`newIds`/`freshIds` 等）；`:220-260` `loadMoreSection`（append 去重，`total` 判定 hasMore）；`:280-324` `handleStreamEvent`（SSE 分发进所有含该类型的栏，`NEW_MARK_TYPES` 于 `:46` = `["super_chat","guard_buy"]`）；`:444-458` `visibleEventsBySection`（hidden钢镚渲染层过滤）；`:460-470` `mixedEventsByColumn`（混排栏 `mergeEventsByTime`）；`:496-534` 按 mode 构造 `sections`（split `:521-534` / mixed `:501-519`）；`:536-625` 渲染 `FeedColumn`；
- 既有测试基底：`apps/bookstore/tests/unit/danmaku-feed-section.test.tsx`（虚拟化/onLoadMore/骨架）、`danmaku-feed-column.test.tsx`、`danmaku-dashboard.test.tsx`、`danmaku-items.test.tsx`（SC/上船条目）、`danmaku-format.test.ts`（guardLevelName/guardLevelTone/formatPrice）；后端 `servers/api/tests/liveEventsNormalize.test.ts:46`（super_chat 透传断言）。

整体顺序：**切开发分支 → 服务端 SC time 透传（TDD）→ 契约 + 前端类型同步 → hoverTopBar 纯函数（TDD）→ useHoverPills（TDD）→ HoverTopBar 组件 + FeedColumn 接线（TDD）→ FeedSection 定位 + 闪光（TDD）→ DanmakuDashboard 路由接线（TDD）→ e2e 适配 + spec 同步 + 收尾验收**。单一开发分支 `feat/danmaku-hover-bar` 共享，前端 subagent 依赖明确，**串行执行**（服务端归一化/契约先行，前端纯函数 → 钩子/组件 → 接线由前到后）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| SC 悬停时长 | 无 `time` 字段；`normalizeSuperChat` 不透传 `data.time` | 契约 + 前端类型新增可选 `time`（秒，仅 super_chat）；normalize 透传上游 `payload.data.time`，缺失回退前端默认 60s |
| 悬停胶囊栏 | 无 | 含 SC/上船类型的栏内容区顶部新增 `HoverTopBar`（约 48px），SC/上船 SSE 实时事件按金额降序置顶展示，倒计时到期消失、无胶囊不占位 |
| SC 胶囊 | 无 | 头像 + 「醒目留言」四字 + `formatPrice`；`scColors.backgroundStart→End` 渐变底色 + `fontColor` 文字色；悬停时长 = 事件 `time` 秒 |
| 上船胶囊 | 无 | 头像 + `guardLevelName(level) ?? guard.name`；`guardLevelTone(level)` 船型强调色；悬停时长 舰长 60s / 提督 5min / 总督 1h（level 1/2/3 映射） |
| 点击定位 + 闪光 | 无 | 点击胶囊按 `eventId` 虚拟化定位到对应记录并播放一次性闪光；目标不在已加载列表（虚拟化回收/历史分页未加载）时滚动列表定位到目标可见后再闪光（复用 `scrollToIndex` + 分页 `onLoadMore` 逼近，到底无更多停止，不无限循环、不盲目放弃） |

DB（MongoDB）、编排（`infra/aspire`）、历史检索路由零变更。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/danmaku-hover-bar`；
- 开发工作（服务端归一化、契约、前端实现、单元测试）全部在**唯一开发分支** `feat/danmaku-hover-bar` 上进行（自 `prd/danmaku-hover-bar` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-hover-bar` 切出 `feat/danmaku-hover-bar`（含 PRD v1.0、提案 v1.0 与本实现计划），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-hover-bar`。

### 步骤 1：服务端透传 SC `time`（normalize.ts，TDD，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md`。改动 `servers/api/src/liveEvents/normalize.ts` 的 `normalizeSuperChat`：

1. **测试先行** `servers/api/tests/liveEventsNormalize.test.ts`：
   - 在既有 super_chat 用例（`:46`）或新增用例断言：payload `data.time: 300`（秒）→ 归一化对象含 `time: 300`；
   - payload 缺 `data.time`（或为 0/非正整数）→ **不携带 `time` 可选字段**（透传与不携带两种分支）；
   - `data.time` 为字符串（如 `"300"`）时 `asNumber` 兼容 → 不携带（`asNumber` 仅收 number；字符串不转，缺失走前端回退；可与合同「缺失回退默认」口径一致，无需字符串转换）。
2. **实现** `normalize.ts`：`normalizeSuperChat` 在返回对象中 `scColors` 之后新增 `...(time !== undefined && time > 0 ? { time } : {})`，其中 `const time = asNumber(data.time)`。复用既有 `asNumber`（`:54`，`Number.isFinite` 已排除 NaN/Infinity）。

**验证**：`pnpm -C servers/api test -- liveEventsNormalize` 全绿。

### 步骤 2：契约 + 前端类型同步（TDD）

1. **契约** `contract/live-events.openapi.yaml` `LiveEvent` schema：在 `scColors`（`:324`）之后新增可选字段 `time`：

   ```yaml
   time:
     type: integer
     description: SC 悬停时长（秒，仅 super_chat；上游 SUPER_CHAT_MESSAGE payload 标准字段 data.time，如 60/120/180/300/3600 档）；缺失时不携带，前端回退默认展示
   ```

2. **前端类型** `apps/bookstore/features/danmaku/types.ts` `LiveEventSchema`：在 `scColors`（`:51`）之后新增 `time: z.number().optional()`，并同步 `ts` 注释（「仅 super_chat，秒」）。
3. **测试**（并入步骤 7/8 前端用例或前端类型测试）：`LiveEventSchema` 解析带 `time` 的 super_chat 事件通过、无 `time` 事件通过（可选不报错）。

**验证**：`pnpm -C servers/api test -- liveEventsNormalize` 仍绿；`pnpm -C apps/bookstore test -- danmaku-types`（或既有 schema 用例）绿；`pnpm -C servers/api lint` 绿。

### 步骤 3：悬停胶囊纯函数（hoverTopBar.ts，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`。新增 `apps/bookstore/features/danmaku/hoverTopBar.ts`：

1. **测试先行** 新增 `apps/bookstore/tests/unit/danmaku-hover-top-bar.test.ts`（复用 `danmaku-format.test.ts` 用例风格）：
   - `isHoverable`：仅 `super_chat` / `guard_buy` 为 true，`danmaku`/`gift`/`online_rank_count` 为 false；
   - `pillPrice`：`LiveEvent.price` 为 number 取其值，缺失 → 0；
   - `hoverDuration`：`super_chat` 时取 `event.time`（秒，`> 0` 才取），缺失/非法/非正 → `SC_DEFAULT_SECONDS`（60）；`guard_buy` 时按 `guard.level`：1→3600、2→300、3→60，缺/未知 → 60；
   - `pillKind`：super_chat → "sc"、其余 → "guard"；
   - `pillSort`：金额降序；金额相同 `arrivedAt` 新者优先（arrivedAt 小=先到，新者优先 = arrivedAt 大在前 → `b.arrivedAt - a.arrivedAt`）。
2. **实现** 新增 `hoverTopBar.ts`（对应提案 §5.2 实现点 2）：

   ```ts
   export type PillKind = "sc" | "guard";
   export interface HoverPill {
     eventId: string;
     kind: PillKind;
     price: number;
     arrivedAt: number;
     expiresAt: number;
     event: LiveEvent;
   }
   export const SC_DEFAULT_SECONDS = 60;
   export function isHoverable(event: LiveEvent): boolean { /* super_chat || guard_buy */ }
   export function pillPrice(event: LiveEvent): number { /* number ? | 0 */ }
   export function hoverDuration(event: LiveEvent): number { /* SC=time(>0) else 60; guard level 1→3600/2→300/3→60/缺→60 */ }
   export function pillKind(event: LiveEvent): PillKind { /* super_chat→"sc" else "guard" */ }
   export function pillSort(a: HoverPill, b: HoverPill): number { /* price desc, arrivedAt desc */ }
   ```

**验证**：`pnpm -C apps/bookstore test -- danmaku-hover-top-bar` 全绿。

### 步骤 4：胶囊集合 + 倒计时（useHoverPills.ts，TDD）

新增 `apps/bookstore/features/danmaku/useHoverPills.ts`：

1. **测试先行** 新增 `apps/bookstore/tests/unit/danmaku-use-hover-pills.test.tsx`（`@testing-library/react` + fake timers，`renderHook`）：
   - `add(event)`：`isHoverable` 且类型属于本栏 `types` 时加入集合，`HoverPill` 的 `arrivedAt ≈ Date.now()`、`expiresAt = arrivedAt + hoverDuration(event)*1000`；
   - 不属本栏 `types` 的 SC/上船不加入；非 hoverable 事件忽略；
   - 同一 `eventId` 重复 add 覆盖（刷新 `arrivedAt`/`expiresAt`）；
   - 单一 interval tick 到超过 `expiresAt` 的胶囊被移除非到期保留（fake timers advance）；
   - `pills` 输出按 `pillSort` 排序；
   - `types` 变化 / 卸载时清理 interval（`vi.runAllTimers` 断言无泄漏）。
2. **实现** `useHoverPills(types: readonly LiveEventType[])`：
   - `pills` state（`HoverPill[]`）+ 单一 `setInterval(500ms)` 统一扫描；
   - `add` 用 `useCallback`，以 `eventId` 为 key 覆盖；内部读 `types`（依赖变化重建回调，interval effect 依赖 `types`）；
   - 每次 tick：`setPills(prev => pillSort(prev.filter(p => p.expiresAt > Date.now())))`；
   - `useEffect` 建 interval 并在 `types` 变化/卸载清除。

**验证**：`pnpm -C apps/bookstore test -- danmaku-use-hover-pills` 全绿。

### 步骤 5：悬停胶囊栏组件（HoverTopBar.tsx）+ FeedColumn 接线（TDD）

新增 `apps/bookstore/features/danmaku/components/HoverTopBar.tsx`；改 `FeedColumn.tsx`：

1. **测试先行** 新增 `apps/bookstore/tests/unit/danmaku-hover-top-bar.test.tsx`：
   - `pills` 为空 → 组件渲染空 div，不占用可见高度（`toEqual`/无可见内容）；
   - SC 胶囊：含「醒目留言」四字 + `formatPrice(price)`（如 `¥30`）；底色样式含 `background` 渐变（`linear-gradient` 于 `scColors.backgroundStart→End`）、文字色 `fontColor`；`scColors` 缺失回退中性底色（不抛错）；
   - 上船胶囊：含 `guardLevelName(level)`（如「舰长」）；船型强调色 class（`bg-eye`/`text-eye` 或回落 `guard.name`）；
   - 胶囊点击回调触发 `onLocate(eventId)`（`user-event` 点击断言）；
   - 多胶囊渲染、`pills` 已排序（排序在 hook，组件按入参顺序渲染）；
   - `role="button"` / `aria-label` 存在（可访问性）。
2. **实现**：
   - `HoverTopBar({ pills, onLocate }: { pills: HoverPill[]; onLocate: (eventId: string) => void })`：
     - 容器 `h-12`（48px）铺满、`flex items-center gap-2 overflow-x-auto px-3 py-1.5`；
     - `pills.length === 0` → 返回 `null`（不占位，对应 PRD F1 无胶囊不占位）；
     - SC 胶囊：`style={{ background: \`linear-gradient(90deg, ${scColors?.backgroundStart ?? "...}, ${scColors?.backgroundEnd ?? "..."})\`, color: scColors?.fontColor ?? "..." }}`，内容 `Sender compact` + 「醒目留言」 + `formatPrice`；`scColors` 缺失回退 `SuperChatItem` 缺省中性底色；
     - 上船胶囊：`guardLevelTone(level)` 的 `chip`/`text`/`item` token 类 + 头像（`Sender compact`）+ `guardLevelName(level) ?? guard.name`；
     - 每个胶囊 `role="button"` + `aria-label` + `cursor-pointer` + `transition-colors duration-150`，点击 `onLocate(pill.eventId)`；按压态 `active:` 反馈；
     - 视觉仅 `@theme` token（渐变/船型色为事件数据色「内容色例外」，容器 token）；过渡 ≤200ms、尊重 `prefers-reduced-motion`（`03-backdoor-design.md`）。
   - `FeedColumn.tsx`：新增可选 `hoverPills?: HoverPill[]`、`onLocate?: (eventId: string) => void` 入参；在 `configPanel`（`:70`）之后、`sections.map` 容器（`:71`）之前渲染 `<HoverTopBar pills={hoverPills ?? []} onLocate={onLocate ?? (()=>{})} />`；`hoverPills` 为空时 `HoverTopBar` 返回 null 不占位，信息流仍 `flex min-h-0 flex-1` 可滚动（`03-backdoor-design.md`）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-hover-top-bar` 全绿；`pnpm -C apps/bookstore test -- danmaku-feed-column`（既有渲染不回归）。

### 步骤 6：按 eventId 定位 + 一次性闪光（FeedSection.tsx，TDD）

改 `apps/bookstore/features/danmaku/components/FeedSection.tsx`：

1. **测试先行** 更新/新增 `apps/bookstore/tests/unit/danmaku-feed-section.test.tsx`：
   - 命中（目标 eventId 在 `events` 已加载数组）：`locate(eventId)` 调用虚拟化 `scrollToIndex(index, { align })`（断言调用于 `rowVirtualizer`/容器 scroll 探针；mock virtualScrollToIndex 被调用且 index 正确、居中 align）；对应行加入 `flashIds` 并渲染闪光 class；
   - 闪光复位：加入 `flashIds` 的行有一次性闪光样式；单计时器到达（约 1s）后该 eventId 从 `flashIds` 移除、样式消失；
   - 未命中（目标不在 `events`，分页未加载）：`locate` 不抛；触发 `onLoadMore` 触底加载逐步逼近新数据，再定位到目标（重复 `scrollToIndex`）；到底无更多（`hasMore=false`/`onLoadMore` 无后续）时停止、落下滚动到目标深度，**不无限循环**；
   - 已定位/重复定位可重新触发闪光（同 eventId 再次加入）；
   - `flashIds` 不入 `getItemKey` 去重 key（`getItemKey` 仍 `rows[index].event.eventId ?? index`）。
2. **实现** `FeedSection.tsx`：
   - 新增 `flashIds: ReadonlySet<string>` state（初始空）+ 单计时器 `flashTimerRef`（约定约 1s：`animate-danmaku-flash`，内层仅 opacity/轻高亮过渡，≤200ms 后柔和淡出，尊重 `prefers-reduced-motion` 降级为仅轻微高亮无位移动画）；
   - `locate(eventId)`：`const idx = rows.findIndex(r => r.event.eventId === eventId)`；命中 → `virtualizer.scrollToIndex(idx, { align: "center" })` 并把 eventId 加入 `flashIds`（单计时器复位后移除）；未命中 → 依 `scrollToIndex` 逼近目标所在深度并触发 `onLoadMore`（复用 `:89-101` `maybeLoadMore`/分页），新一轮数据后再 `findIndex` 重定位，`hasMore=false`/到达列表末尾即停止、落下滚动到目标深度——**绝不以目标不在列表就在回调里静默放弃**（PRD F4/边界口径）；
   - 暴露 `locate` 于 `useImperativeHandle`（`FeedSectionHandle.locate(eventId)`），供 `FeedColumn`/`DanmakuDashboard` 经 ref 调用（或由 `FeedColumn` 持有小节 ref 汇总）；
   - 虚拟行内层（`:179-187` 现挂 `animate-danmaku-enter` 的 div）叠加闪光：`flashIds.has(row.event.eventId)` 时挂 `animate-danmaku-flash`（内层不改行高，不影响 `measureElement` 测量的 wrapper，`03-backdoor-design.md` 无布局跳动）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-feed-section` 全绿；`pnpm -C apps/bookstore test -- danmaku-feed-column` 不回归。

### 步骤 7：DanmakuDashboard 接线（useHoverPills + handleLocate 路由，TDD）

改 `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx`：

1. **测试先行** 更新 `apps/bookstore/tests/unit/danmaku-dashboard.test.tsx`：
   - 渲染含 SC/上船类型的栏顶部出现 `HoverTopBar`；无 SC/上船类型栏不渲染；
   - SSE `handleStreamEvent` 到达 super_chat/guard_buy（`isHoverable`）→ `useHoverPills` 集合增胶囊；到达 danmaku/gift → 不增；
   - `handleLocate(eventId)`：定位路由到含目标类型的 `FeedSection.locate`（依据目标 `eventId` 的 `event.type` 匹配含该类型的节）；
   - 既有 SSE/已读/隐藏钢镚/礼物过滤用例保持绿（零回归）。
2. **实现** `DanmakuDashboard.tsx`：
   - `const hoverTypes = useMemo(() => columns.flatMap(c => c.types), [columns])`（其中过滤 `super_chat`/`guard_buy`，或 `isHoverable` 判定，供 `useHoverPills` 用）；
   - `const { pills, add } = useHoverPills(hoverTypes)`；
   - `handleStreamEvent` 内追加：`if (isHoverable(event)) add(event)`（所有含 SC/上船类型的栏共用一个胶囊集合；同一 `eventId` 在多个栏重复分发 → `add` 覆盖不重复）。**注意**：胶囊集合为「栏无关」还是「栏级」需结合渲染——若 `FeedColumn` 每栏独立取 `pills` 则共享集合即可，`HoverPill` 展示数据取自 `event`，与栏归属无关（见步骤 5 渲染）；
   - `handleLocate(eventId)`：由胶囊点击触发，**按目标 `eventId` 的类型路由到包含该类型的节**——某混排栏含 SC+上船时精确路由到含目标类型的 `FeedSection`（多类型混排栏定位路由，提案实现点 5 风险③）。实现经 ref 汇总各 `FeedSection.locate`（`FeedColumn` 转发或 Dashboard 持有小节 ref 目录 `<colId:type → locate>`）：`locate(eventId)` 时查 `eventsBySection` 中 `eventId` 落入哪些节、取第一节调用其 `locate`；
   - 传 `hoverPills={pills}` 与 `onLocate={handleLocate}` 给每个含 SC/上船类型的 `FeedColumn`（`:536` 渲染处）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 8：e2e 适配与收尾验收

1. **e2e 适配**（SKILL: z-test，`tests/e2e/`）：既有弹幕看板 e2e 若不涉及悬停栏保持不变（空时 `HoverTopBar` 返回 null 不占位、不影响断言）；若需要，补一条「SSE 到达 SC → 顶部出现胶囊、点击后信息流滚动定位并闪光」的最小 e2e（可在 dev 回放 `replayTest("super_chat")` 驱动，`DanmakuDashboard` 已暴露 `replayTest`）。无契约破坏，`live-events` 既有 API/e2e 保持绿；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内、按开发分支落地时同步）：更新 `docs/product/spec/danmaku.md`（悬停胶囊栏现态：作用范围、SC/上船胶囊展示与配色、悬停时长、倒计时消失、点击定位 + 一次性闪光；SC `time` 字段口径）、`docs/engineering/spec/frontend-bookstore.md`（`hoverTopBar.ts`/`useHoverPills`/`HoverTopBar`/`FeedSection.locate+flashIds`/`FeedColumn`/`DanmakuDashboard` 接线现态）；PRD 与提案为时点文档，不改原文；
3. 检查 `apps/bookstore/AGENTS.md`「弹幕看板约定」「组件 `features/danmaku/components/`」段落是否需同步新口径；
4. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（悬停栏呈现、金额降序、SC/上船胶囊配色与时长、倒计时消失、点击定位+闪光、目标不在已加载列表时滚动定位不盲目放弃、既有能力零回归）；
5. 推送 `feat/danmaku-hover-bar` 并提 PR 至 `prd/danmaku-hover-bar`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：弹幕看板一期/二期/三期既有实现（`FeedColumn`/`FeedSection`/`useLiveEventStream`/`DanmakuDashboard`/`SuperChatItem`/`GuardItem`/`Sender`/`columns.ts`）；`LiveEvent.scColors`/`price`/`guard.level` 既有契约字段；`useAnchoredFeed`、`@tanstack/react-virtual`、`useSyncExternalStore` 既有基建；上游 `SUPER_CHAT_MESSAGE # payload.data.time`（提案 §3 契约新增字段的唯一来源）；
- **并行协调**：单一开发分支 `feat/danmaku-hover-bar`；依赖链明确（normalize → 契约 → 纯函数 → 钩子 → 组件 → 接线），subagent 串行；无 DB/编排变更；
- **风险**（对应提案 §5.2 与 §6.1）：
  - **SC `time` 缺失/非法**：`asNumber` 不收非 number（字符串 `"300"` → undefined → 不携带）；前端 `hoverDuration` 对非正 `time` 回退 60s（PRD §3.4 边界）。SC `time` 是只读展示字段，无越权面；
  - **胶囊集合共享语义**：SSE 同一 `eventId` 在多栏重复时不被重复入列（`add` 以 `eventId` 覆盖）；悬停胶囊只认 SSE 实时到达，历史分页不注入悬停栏（PRD §3.4）；
  - **计时漂移/后台节流**：基于 `expiresAt` 时间戳判定而非剩余秒数（提案实现点 2 风险、PRD §4.1），后台 tab 节流到期即清；刷新页面清空悬停胶囊属预期（不持久化）；
  - **Flash 与虚拟化**：闪光只作用虚拟行内层（不改行高），避免 `measureElement` 重测跳动（提案实现点 5 技术细节）；`flashIds` 不入 `getItemKey`；闪光动画尊重 `prefers-reduced-motion`（降级为轻微高亮、无位移动画）；
  - **目标不在已加载列表的定位**：必须滚动列表定位（`scrollToIndex` 逼近 + 复用分页 `onLoadMore` 触底加载逐步逼近），到底无更多即停止防止无限循环；**绝不因目标不在列表就在胶囊点击时直接放弃定位**（PRD F4/边界，返工口径）。SC/上船不在弹幕折叠（`merge.ts` 仅折叠弹幕）范围，命中安全（提案实现点 5 风险①）；
  - **多类型混排栏定位路由**：`FeedColumn` 多小节（上下分栏）与混排（`mixedEventsByColumn`）场景下，`handleLocate` 须按目标 `eventId` 类型路由到含该类型的节（提案实现点 5 风险③）；
  - **既有测试回归**：`danmaku-feed-section.test.tsx`（新增定位/闪光用例）、`danmaku-dashboard.test.tsx`（接线用例）随步骤 6/7 更新，避免红测试残留。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-23-danmaku-hover-bar-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-23-danmaku-hover-bar-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]、后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 契约：`contract/live-events.openapi.yaml`
- 参照实现方案：[[2026-08-22-danmaku-board-v3-impl-plan.md]]（接线/收尾口径）、[[2026-08-17-danmaku-board-v2-impl-plan.md]]、[[2026-08-16-danmaku-backdoor-impl-plan.md]]