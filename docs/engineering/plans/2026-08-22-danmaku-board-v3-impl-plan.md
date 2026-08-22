---
description: 弹幕看板三期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（唯一开发分支 feat/danmaku-board-v3，纯前端三项改造：columns.ts 默认三栏/两栏预设调整、hideLowSc 隐藏钢镚开关（localStorage 存取 + isScHidden 纯函数 + 看板 SC 展示/实时过滤）、MarkReadButtonGroup 顶部按钮组（上收上船/SC 全部已读 + 隐藏钢镚，空间不足折 dropdown）+ FeedColumn 移除栏头全部已读 + page 双页头挂载；无契约/服务端变更，全部单测 TDD）
type: Permanent
---

# 弹幕看板三期 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-22-danmaku-board-v3-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-22-danmaku-board-v3-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-board-v3`
**开发分支**: `feat/danmaku-board-v3`（自需求总分支切出，**唯一开发分支**，全部实现与测试同在此分支）
**版本**: v1.0（2026-08-22）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `apps/bookstore/features/danmaku/columns.ts:12-26`：`DEFAULT_COLUMNS`（3 栏）= `[gift 分节 | guard_sc 分节 | danmaku 分节]`，`COLUMN_PRESETS[2]` = `[guard_sc 分节 | gift_danmaku 混排]`，`COLUMN_PRESETS[1]` 全部混排；`loadColumns`/`parseColumns`（`:54-67`）损坏回退默认；`saveColumns` + `useSyncExternalStore` 快照（`getColumnsSnapshot`/`subscribeColumns`）跨组件/跨标签同步（`:69-107`）——**本期隐藏钢镚存储将复用这套「store + useSyncExternalStore」口径**（见步骤 2）；
- `apps/bookstore/features/danmaku/mergeEnabled.ts` 与 `giftMinPrice.ts`：无 `useSyncExternalStore` 的「单组件持有」存储口径 —— 提案 §2.3/§4 假设「隐藏钢镚仅看板单组件持有」。**该假设在本期不成立**：按钮组位于页头（`page.tsx`），与看板分属两个组件，需要跨组件同步，故 `hideLowSc.ts` 走 `columns.ts` 的 store 口径而非 `mergeEnabled`/`giftMinPrice` 口径（步骤 2 详述，对提案的一处收紧）；
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx`：`:40` `READ_ALL_TYPES = ["super_chat","guard_buy"]`；`:92` `canManage = atLeast(role,"admin")`；`:144-149` `minPrice`/`minPriceRef`（实时丢弃低价礼物读 ref）；`:268-310` `handleStreamEvent`（`:271` 低价礼物 `return` 丢弃，`:273-277` 插入判定读 `eventsBySectionRef`，`:288` setEvents 分发到所有含该类型的栏）；`:379-400` `handleReadAll(type)`（调 `markAllLiveEventsRead` → 全类型置 read + 清 New）；`:429-438` `mixedEventsByColumn`（`mergeEventsByTime` 合并混排栏）；`:467-502` 按 mode 构造 sections（split 直接 `eventsBySection[key]`、mixed 用 `mixedEventsByColumn[col.id]`）；`:504-516` 给 `FeedColumn` 传 `readAllTypes`（按栏含 super_chat/guard_buy 过滤）与 `onReadAll`（= handleReadAll）；
- `apps/bookstore/features/danmaku/components/FeedColumn.tsx`：`:8-11` `READ_ALL_LABELS`、`:14` `CONFIRM_TIMEOUT_MS=3000`、`:74-93` `confirming` 二次确认状态与 `handleReadAllClick`、`:100-114` 栏头渲染 `readAllTypes.map` 全部已读按钮、`:48-49` 入参 `readAllTypes`/`onReadAll`；
- `apps/bookstore/app/backdoor/(dashboard)/danmaku/page.tsx`：`:55` 普通页头、`:98` 全屏页头均渲染 `<ColumnCountSelector/>`（「视图栏」）；`:19` 持有 `dashboardRef`（`DanmakuDashboardHandle`，`:249` 已现 `useImperativeHandle` 暴露 `replayTest`）；
- `apps/bookstore/features/danmaku/components/ColumnCountSelector.tsx:20-53`：`useSyncExternalStore` 读栏上配置，自持 `useMediaQuery`/`tier`——「视图栏」现有折叠能力基建可复用；
- 测试基底（均需按本期迁移/新增再断言）：`apps/bookstore/tests/unit/danmaku-columns.test.ts`（默认栏断言）、`danmaku-dashboard.test.tsx:214-229`（member 无全部已读按钮、SC 全部已读经 `FeedColumn` 触发）、`danmaku-feed-column.test.tsx:76-111`（栏头全部已读二次确认）、`danmaku-page.test.tsx`、`danmaku-gift-min-price.test.ts`/`danmaku-merge-enabled.test.ts`（存储损坏回退既有口径样例）。

整体顺序：**切开发分支 → columns 默认调整（TDD）→ hideLowSc store（TDD）→ MarkReadButtonGroup（TDD）→ DanmakuDashboard SC 过滤 + readAll 透出 + FeedColumn 移除（TDD）→ page 双页头挂载 → e2e 适配 + 收尾验收**。单一开发分支 `feat/danmaku-board-v3` 共享，各实现 subagent **串行执行**（组件间依赖，页面挂载依赖组件就绪）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 默认三栏 | `[礼物 \| 上船+SC 分节 \| 弹幕]`（columns.ts:12-16） | `[礼物+上船 混排 \| SC \| 弹幕]`（column id `gift_guard`/`sc`/`danmaku`，mode mixed） |
| 两栏预设 | `[上船+SC 分节 \| 礼物+弹幕 混排]`（columns.ts:21-24） | `[上船+SC 混排 \| 弹幕+礼物 混排]`（`guard_sc`/`gift_danmaku`，全 mixed） |
| 单栏预设 | 全部四类混排（columns.ts:20） | 不变 |
| 隐藏钢镚 | 无 | 新增 `hideLowSc.ts`（store + useSyncExternalStore + `isScHidden`），`danmaku-backdoor.hide-low-sc` JSON boolean，损坏回退 false；所有 SC 面板 `price<30` 隐藏、`>=30` 显示；实时低价 SC 丢弃 |
| 全部已读入口 | 分散在各 `FeedColumn` 栏头（READ_ALL_LABELS + 3s 二次确认） | 上收至页头「标记已读」按钮组（`MarkReadButtonGroup`），admin+ 可见，空间不足折 dropdown |
| 隐藏钢镚入口 | 无 | 并入 `MarkReadButtonGroup`（含 member 仅显示该开关） |
| 页头 | 仅 `ColumnCountSelector`/全屏/检索 | 普通与全屏页头 `ColumnCountSelector` 左侧挂 `MarkReadButtonGroup` |

契约（`contract/`）、服务端（`servers/api`）、编排（`infra/aspire`）零变更。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/danmaku-board-v3`；
- 开发工作（前端实现、单元测试）全部在**唯一开发分支** `feat/danmaku-board-v3` 上进行（自 `prd/danmaku-board-v3` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-board-v3` 切出 `feat/danmaku-board-v3`（含 PRD v1.0、提案 v1.0 与本实现计划），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-board-v3`。

### 步骤 1：默认分栏布局调整（columns.ts，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`。全程 TDD：先改测试再实现。改动面：

1. **测试先行** `tests/unit/danmaku-columns.test.ts`：把默认三栏断言更新为 id `gift_guard`/`sc`/`danmaku`、types 分布与 mode `mixed`；`COLUMN_PRESETS[2]` 断言更新为 `[guard_sc, gift_danmaku]` 全 mixed；单栏断言不变；损坏回退（localStorage 非法值时 `loadColumns` 回退）断言按新默认更新；
2. **实现** `features/danmaku/columns.ts`：改 `DEFAULT_COLUMNS` 与 `COLUMN_PRESETS[2]`（对应提案 §5.2 实现点 1 代码），`resolveColumns`/`parseColumns`/`loadColumns`/`saveColumns`/store 订阅零改动；
3. 注意旧库存配置含旧 id（`gift`/`guard_sc`）仅影响 id 标识与未来迁移，不影响功能（PRD「不迁移」口径）；`resolveColumns` 对界内自定义配置原样保留，越界才用预设覆盖。

**验证**：`pnpm -C apps/bookstore test -- danmaku-columns` 与 `danmaku-dashboard`（首屏默认栏断言）全绿。

### 步骤 2：隐藏钢镚存取与判定（hideLowSc.ts，TDD）

1. **测试先行** 新增 `tests/unit/danmaku-hide-low-sc.test.ts`（仿 `danmaku-gift-min-price.test.ts` + `danmaku-merge-enabled.test.ts` 口径，另补 store 快照）：`loadHideLowSc()` 无存储/损坏回退 false、读写往返、`typeof !== "boolean"` 回退 false；`isScHidden(undefined)=false`、`isScHidden(29)=true`、`isScHidden(30)=false`、`isScHidden(31)=false`；`getHideLowScSnapshot` 缓存（raw 未变返回稳定引用）、`saveHideLowSc` 通知订阅者、storage 事件跨标签同步；
2. **实现** 新增 `features/danmaku/hideLowSc.ts`——**对提案 §2.3/§4 的一处收紧**：因隐藏钢镚开关位于页头按钮组、消费于看板，跨组件共享，故复用 `columns.ts` 的「localStorage + `useSyncExternalStore` + storage 事件」store 口径，而非 `mergeEnabled`/`giftMinPrice` 的单组件持有口径：

   - `HIDE_LOW_SC_STORAGE_KEY = "danmaku-backdoor.hide-low-sc"`；
   - 纯函数 `isScHidden(price: number | undefined): boolean`：`price !== undefined && price < 30`（缺金额保守不隐藏，对齐 PRD §3.4）；
   - `loadHideLowSc(): boolean`（读 + JSON parse + `typeof === "boolean"` 校验，损坏回退 false）、`saveHideLowSc(v: boolean)`（写 JSON boolean + 通知订阅者）；
   - store 快照：`getHideLowScSnapshot(): boolean`（raw 字符串缓存 + 稳定引用）、`getHideLowScServerSnapshot(): false`、`subscribeHideLowSc(onChange): () => void`（监听 storage 事件，仿 columns.ts:97-107）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-hide-low-sc` 全绿。

### 步骤 3：「标记已读」按钮组（MarkReadButtonGroup.tsx，TDD）

1. **测试先行** 新增 `tests/unit/danmaku-mark-read-button-group.test.tsx`：admin 平铺渲染「上船 全部已读」「SC 全部已读」「隐藏钢镚」三项；点击「全部已读」进入「确认全部已读？」态、3s（fake timers）超时自动复位、确认即 `onReadAll(type)`；「隐藏钢镚」为 `role="switch"`+`aria-checked`，点击回调 `onToggleHideLowSc`；member（`canManage=false`）仅渲染「隐藏钢镚」不渲染全部已读；空间不足（mock `useMediaQuery`/宽度）折叠为单个「标记已读」触发钮，点击展开 dropdown 菜单含三项、点项后收起，宽度恢复还原平铺；
2. **实现** 新增 `features/danmaku/components/MarkReadButtonGroup.tsx`（对应提案 §5.2 实现点 3）：

   - 自 `features/backdoor/session.tsx` `useSession` + `atLeast` 算 `canManage`（与看板一致口径，页面无需传）；
   - 入参：`hideLowSc: boolean`、`onToggleHideLowSc(): void`、`onReadAll(type: ReadAllType)`；
   - 内部 `confirming: ReadAllType | null` + 3s `CONFIRM_TIMEOUT_MS` 复位（自 `FeedColumn` 迁入）、`READ_ALL_LABELS`（自 `FeedColumn` 迁入）；
   - 「隐藏钢镚」：`role="switch"` + `aria-checked`，label「隐藏钢镚」，点击回调 `onToggleHideLowSc`；
   - **空间不足折叠**：复用 `lib/useMediaQuery.ts`（narrow `<640`）与可用宽度判定；平铺所需宽度不足时渲染单个「标记已读」触发钮 + dropdown（菜单内为上述各项，点击后收起）；dropdown 开合仅 opacity 过渡（≤200ms，尊重 `prefers-reduced-motion`，对标 `03-backdoor-design.md`）；
   - 视觉：仅 `@theme` token 色（`border-vine/50`/`bg-raised`/`text-ink-dim`/`active: border-flower text-ink` 等既有按钮态），禁硬编码色值。

**验证**：`pnpm -C apps/bookstore test -- danmaku-mark-read-button-group` 全绿。

### 步骤 4：看板 SC 过滤 + readAll 透出 + FeedColumn 移除（TDD）

1. **测试先行** 更新/新增：
   - `tests/unit/danmaku-dashboard.test.tsx`——SC 历史展示过滤：hideLowSc 开启时 split SC 节与 mixed（弹幕+SC）节中 `price<30` 去除、`>=30` 保留，关闭恢复；`handleStreamEvent`（经 `streamHandler`）到达 `price<30` SC 时丢弃（不插入、不清 New）、`>=30` SC 正常 prepend 并置 New；已读状态/New 不被隐藏回溯；将原 `:214-229`「member 无全部已读按钮」「SC 全部已读经 FeedColumn 触发」两条断言迁移为：经 ref 调用 `readAll("super_chat")` 触发 `markAllLiveEventsRead` 且 `setNewIds` 清该类型——（看板测试不再渲染页头按钮组，按钮组交互在 `danmaku-mark-read-button-group` 独立覆盖）；
   - `tests/unit/danmaku-feed-column.test.tsx`——删除 `:76-111` 全部已读相关用例（`onReadAll`/`readAllTypes`/二次确认），保留栏头其余功能（`headerExtra`/`configPanel`/`mergeEnabled` 透传等）断言；
   - `tests/unit/danmaku-page.test.tsx`——页面挂载 `MarkReadButtonGroup`（普通/全屏页头各一）、经 ref 点击 SC 全部已读触发 `markAllLiveEventsRead`、隐藏钢镚开关写入 localStorage 并经 store 同步到看板过滤；
   - `tests/unit/danmaku-hide-low-sc.test.ts` 补 store 跨组件同步读断言（如需）。
2. **实现**：
   - `features/danmaku/components/FeedColumn.tsx`：移除 `readAllTypes`/`onReadAll` 入参、`READ_ALL_LABELS`、`confirming`/`confirmTimerRef`/`handleReadAllClick` 及栏头 `readAllTypes.map` 渲染（对应提案实现点 3 风险①「新旧入口不并存」）；保留 `title`/`sections`/`headerExtra`/`configPanel` 等其余栏头功能；
   - `features/danmaku/components/DanmakuDashboard.tsx`：
     - `import { getHideLowScSnapshot, getHideLowScServerSnapshot, subscribeHideLowSc, isScHidden } from "../hideLowSc"`，`const hideLowSc = useSyncExternalStore(subscribeHideLowSc, getHideLowScSnapshot, getHideLowScServerSnapshot)`，`hideLowScRef` 同步镜像（供 `handleStreamEvent` 读新鲜值，仿 `minPriceRef`）；
     - **展示过滤统一在节数据层**（对提案「节/mixed 合并处过滤」的一处落地选择，避免 SC/混排节点遗漏）：新增 `visibleEventsBySection = useMemo(() => map over eventsBySection, 当 hideLowSc 时对 super_chat 列表 filter(!isScHidden(price))，其余原样, [eventsBySection, hideLowSc])`；split 节 `events` 改取 `visibleEventsBySection[key]`，`mixedEventsByColumn` 的合并源改取 `visibleEventsBySection`（SC 混排一并过滤）；**原始 `eventsBySection`/`eventsBySectionRef` 保持不过滤**（供 `handleStreamEvent` 去重判定与 loadMore 分页长度），仅在渲染层过滤，不触发重查、不影响已读水位与 New（提案实现点 2 风险② 口径）；
     - **实时过滤**：`handleStreamEvent` 顶部新增 `if (event.type === "super_chat" && hideLowScRef.current && isScHidden(event.price)) return;`（不插入、不进 New、不标入场），紧邻既有低价礼物丢弃（`:271`），与历史共用同一 `isScHidden` 谓词（提案风险①）；
     - **readAll 透出**：把现有 `handleReadAll` 经 `useImperativeHandle` 暴露为 `DanmakuDashboardHandle.readAll(type)`（扩展现有 `replayTest` 代面）；`FeedColumn` 不再接收 `readAllTypes`/`onReadAll`，删除 `:513-516` 该两 prop 传参。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿（含迁移后 feed-column/dashboard/page 用例）。

### 步骤 5：页头挂载按钮组（page.tsx）

1. **测试先行**（并入步骤 4 的 `danmaku-page.test.tsx`，此处实现）：`app/backdoor/(dashboard)/danmaku/page.tsx` 普通页头（`:55` `ColumnCountSelector` 前）与全屏页头（`:98` 前）各挂 `<MarkReadButtonGroup hideLowSc onToggleHideLowSc onReadAll={readAllFromRef} />`；
2. **实现**：页面层 `useSyncExternalStore(subscribeHideLowSc, getHideLowScSnapshot, getHideLowScServerSnapshot)` 取 `hideLowSc`（因 `MarkReadButtonGroup` 自算 `canManage`，页面只需喂 hideLowSc 与两回调）；`onToggleHideLowSc = () => saveHideLowSc(!hideLowSc)`；`readAllFromRef = (type) => dashboardRef.current?.readAll(type)`（`dashboardRef` 已存在 `:19`，普通/全屏各挂一次但同一 ref，仅一个 dashboard 挂载时指向有效实例）；`isSubmitting`/toast 等无新增。

**验证**：`pnpm -C apps/bookstore test -- danmaku-page` 全绿。

### 步骤 6：e2e 适配与收尾验收

1. **e2e 适配**（SKILL: z-test，`tests/e2e/`）：既有弹幕看板 e2e 若断言栏头「全部已读」（`FeedColumn`），迁移到顶部「标记已读」按钮组（admin 平铺 / member 仅隐藏钢镚 / narrow 折 dropdown）；无契约变更，SSE/检索用例保持；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内、按开发分支落地时同步）：更新 `docs/product/spec/danmaku.md`（默认三栏/两栏预设现态、隐藏钢镚阈值与持久化 key、顶部标记已读按钮组现态）、`docs/engineering/spec/frontend-bookstore.md`（`hideLowSc.ts`/`MarkReadButtonGroup`/看板接入/FeedColumn 变更现态）；PRD 与提案为时点文档，不改原文；
3. 检查 `apps/bookstore/AGENTS.md`「弹幕看板约定」段落是否需同步新口径（默认栏、隐藏钢镚、按钮组）；
4. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（含「清除本地配置后桌面三栏为 礼物+上船混排 | SC | 弹幕」、两栏「上船+SC 混排 | 弹幕+礼物混排」、单栏不变、存量配置保持、隐藏钢镚损坏回退关闭）；
5. 推送 `feat/danmaku-board-v3` 并提 PR 至 `prd/danmaku-board-v3`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：弹幕看板一期/二期 + 礼物筛选 + 视觉优化既有实现；`LiveEvent.price`（`types.ts:50`）既有契约字段直接消费，无字段/无契约变更；`useMediaQuery`、`useSyncExternalStore`、`@tanstack/react-virtual` 既有基建；
- **并行协调**：单一开发分支 `feat/danmaku-board-v3`；组件依赖明确（hideLowSc → 按钮组/看板；按钮组 → readAll 透出），subagent 串行；无 API/e2e 契约变更；
- **风险**（对应提案 §5.2 与 §6.1）：
  - **隐藏钢镚跨组件同步**：开关在页头、过滤在看板，`mergeEnabled`/`giftMinPrice` 的单组件持有口径不适用 → 采用 `columns.ts` 的 store + `useSyncExternalStore` 口径（步骤 2 收紧），测试覆盖快照缓存与 storage 跨标签事件；
  - **SC 过滤遗漏**：SK 均落在「单类型 SC 节 + 混排节」→ 统一在 `visibleEventsBySection` 派生层过滤（原始 `eventsBySection` 不过滤保去重/分页），实时与历史共用 `isScHidden` 谓词；
  - **隐藏不回溯已读/New**：过滤仅作用于渲染与实时插入，不触发重查、不改已读水位与 New（PRD §3.4 口径）；
  - **新旧「全部已读」入口并存**：移除 `FeedColumn` 的 `readAllTypes`/`onReadAll`/`READ_ALL_LABELS`/`confirming`，二次确认上收至按钮组，避免重复入口；
  - **按钮组折叠断点**：admin 3 项 / member 1 项「隐藏钢镚」，按实际渲染项数 + 可用宽度判定折叠，保证 member 不会无故塌成 dropdown（提案风险②）；
  - **既有测试断言迁移**：`danmaku-dashboard.test.tsx:214-229`、`danmaku-feed-column.test.tsx:76-111` 的全已读断言自栏头迁移到按钮组/ref，随步骤 4 一并更新，避免红测试残留。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-22-danmaku-board-v3-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-22-danmaku-board-v3-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 礼物筛选实现方案：[[2026-08-17-danmaku-gift-min-price-impl-plan.md]]（存储/过滤/重载 TDD 口径参照）