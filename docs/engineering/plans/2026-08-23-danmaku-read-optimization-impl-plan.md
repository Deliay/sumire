---
description: 弹幕看板「已读功能优化」实现方案 v1.0——基于 PRD v1.0（含返工：礼物单条+全部已读纳入）与技术提案 v1.0 的实施计划。唯一开发分支 feat/danmaku-read-optimization：契约 read-all type 枚举加 gift → 后端 READ_ALL_TYPES + read-all 走 toUpstreamTypes 展开 gift+gift_v2 → 前端 ReadAllType/MarkReadButtonGroup 礼物全部已读 → GiftItem 接线单条已读 → SC/礼物/上船双击改单击 → SC 留言文字区单击已读 + 拖选区分 + 防重复 toggle → 穿透元素（B 站链接/头像昵称）stopPropagation 防吞，全部单测 TDD；DB/编排零变更。
type: Permanent
---

# 弹幕看板「已读功能优化」实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-23-danmaku-read-optimization-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-23-danmaku-read-optimization-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-read-optimization`
**开发分支**: `feat/danmaku-read-optimization`（自需求总分支切出，**唯一开发分支**，全部实现与测试同在此分支）
**版本**: v1.0（2026-08-23）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `apps/bookstore/features/danmaku/components/SuperChatItem.tsx:29-30`：根节点 `onDoubleClick` 触发 `onToggleRead`、`title="双击切换已读"`；`:52-53` 留言 `<p>` 为 `select-text cursor-text` + `onDoubleClick stopPropagation`（拖选复制 + 隔离已读）；`:39` Sender 在头部行（非留言段内）；`:71-72` `hasBiliLink` 时留言渲染 `BiliVideoLink`；
- `apps/bookstore/features/danmaku/components/GuardItem.tsx:27-31`：根节点 `onDoubleClick` 触发 `onToggleRead`、`title="双击切换已读"`、`select-none cursor-pointer`（上船无文字复制诉求）；
- `apps/bookstore/features/danmaku/components/GiftItem.tsx:8-17`：`GiftItemProps` 仅 `{ event }`，**无 `onToggleRead`**、根节点无 `onClick`/`title`；
- `apps/bookstore/features/danmaku/components/FeedSection.tsx:194` `const toggleRead = canManage ? onToggleRead : undefined;`；`:202` gift 分支 `return <GiftItem event={event} />`（未传 `onToggleRead`），super_chat 与 guard_buy 已传（`:200,204`）；
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx:534-556` `toggleRead`：按 `eventId` 定位 `updateEvent` + `markLiveEventRead/Unread` 乐观更新失败回滚，**type 无关**（天然支持 gift）；`:558-579` `handleReadAll` 按 `e.type === type` 置已读并清该类型 New（normalized 的 gift_v2 亦为 `type:"gift"`，天然匹配）；
- `apps/bookstore/features/danmaku/api.ts:18` `type ReadAllType = "super_chat" | "guard_buy";`；
- `apps/bookstore/features/danmaku/components/MarkReadButtonGroup.tsx:10-13` `READ_ALL_LABELS` 仅 SC/上船两项；`:44` `itemCount = (canManage ? 2 : 0) + 1`（readAll 按钮 + 隐藏钢镚）；`:79` `readAllTypes = canManage ? ["guard_buy", "super_chat"] : []`；`:66-77` 二次确认 3s 复位逻辑复用自增；
- `servers/api/src/routes/liveEvents.ts:12` `READ_ALL_TYPES = ["super_chat", "guard_buy"]`；`:46-48` `toUpstreamTypes` 已实现 `gift → ["gift","gift_v2"]`；`:300` read-all 现为 `deps.upstream.fetchRange([type], 1, READ_ALL_PAGE_SIZE)`（未展开 gift）；`:313` `markAllRead(type, ...)` 写 `watermark:{type}`（任意 type，数据模型已支持 gift）；
- `servers/api/src/db/liveEventReads.ts:86` `markAllRead(type, readBefore, readBy)`（`$max` 水位线只前进）；`typeFromEventId` 已含 gift；
- `contract/live-events.openapi.yaml:201` read-all `type` 枚举 `[super_chat, guard_buy]`；`:232` LiveEvent `type` 枚举已含 `gift`；
- 穿透元素已具备 `stopPropagation`：`Sender.tsx:38-39` `<a>` `onClick/onDoubleClick stopPropagation`（头像昵称 new 开空间）；`BiliVideoLink.tsx:123-124` `BiliLinkSegment` `<a>` `onClick/onDoubleClick stopPropagation` + `:125-126` `onMouseEnter/Leave` 驱动 hover 预览；
- 既有测试基底：`apps/bookstore/tests/unit/danmaku-items.test.tsx`（SC/上船条目）、`danmaku-sender.test.tsx`、`danmaku-mark-read-button-group.test.tsx`、`danmaku-dashboard.test.tsx`（含 `:244` `readAll("super_chat")` 用例）、`danmaku-feed-section.test.tsx`；后端 `servers/api/tests/liveEvents.test.ts`（read-all 既有用例）。

整体顺序：**切开发分支 → 契约 read-all 枚举 + 前端 ReadAllType（TDD）→ 后端 read-all 支持 gift 且展开 upstream（TDD）→ 前端「礼物 全部已读」按钮组（TDD）→ 礼物单条已读接线（GiftItem + FeedSection，TDD）→ SC/上船/礼物已读双击改单击（SuperChatItem/GuardItem/GiftItem title+onClick，TDD）→ SC 留言文字区单击已读 + 拖选区分 + 防重复 toggle（SuperChatItem，TDD）→ 穿透回归测试 + e2e 适配 + spec 同步 + 收尾验收**。单一开发分支 `feat/danmaku-read-optimization` 共享，前端 subagent 依赖明确，**串行执行**（契约/后端先行，前端类型 → 按钮组 → 条目组件由前后到）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 礼物已读 | `GiftItem` 无 `onToggleRead`、无 `onClick`；`FeedSection.renderItem` gift 分支未传 `toggleRead` | `GiftItem` 增 `onToggleRead?` + 根节点 `onClick` + 已读置灰 `opacity-60` + `title="单击切换已读"`；`FeedSection` gift 分支传入 `toggleRead` |
| 已读切换方式 | SC/上船 `onDoubleClick` 触发；`title="双击切换已读"` | SC / 礼物 / 上船统一 `onClick` 触发；`title` 改「单击切换已读」；double click 语义为两次单击往返（可接受） |
| SC 留言文字区 | `select-text cursor-text` + `onDoubleClick` stopPropagation（拖选复制、文字区不触发已读） | 文字区加入单击已读响应域：干净单击切换已读、拖选（`getSelection` Range 非折叠）不触发；防根节点重复 toggle（`stopPropagation`） |
| 穿透元素 | `Sender`/`BiliLinkSegment` 已 `stopPropagation`（点击不冒泡） | 保持 stopPropagation，使根节点改单击后仍穿透 B 站不触发已读；回归测试覆盖 |
| 礼物全部已读 | `read-all` 契约枚举 `[super_chat, guard_buy]`；`READ_ALL_TYPES` 同；`fetchRange([type])` 未展开；前端 `ReadAllType`/按钮组无礼物项 | 契约枚举 + `READ_ALL_TYPES` 加 `gift`；read-all 对 gift 走 `toUpstreamTypes` 展开 `gift`+`gift_v2` 取并集最新写 `watermark:gift`；前端 `ReadAllType` + `MarkReadButtonGroup` 增「礼物 全部已读」项（`itemCount` 2→3） |

DB（MongoDB）、编排（`infra/aspire`）、历史检索路由零变更；无新增端点点。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/danmaku-read-optimization`；
- 开发工作（契约、后端、前端实现、单元测试）全部在**唯一开发分支** `feat/danmaku-read-optimization` 上进行（自 `prd/danmaku-read-optimization` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-read-optimization` 切出 `feat/danmaku-read-optimization`（含 PRD v1.0、提案 v1.0 与本实现计划），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-read-optimization`。

### 步骤 1：契约 read-all 枚举 + 前端 ReadAllType 同步（TDD）

加载 `docs/engineering/backend-rules.md`、`apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。

1. **契约** `contract/live-events.openapi.yaml` 的 `/api/live-events/read-all`（`:201`）`type` 枚举由 `[super_chat, guard_buy]` 扩展为 `[super_chat, guard_buy, gift]`，description 同步「含礼物」：
   ```yaml
   type:
     type: string
     enum: [super_chat, guard_buy, gift]
     description: 支持需要已读管理的类型（含礼物）
   ```
2. **前端类型** `apps/bookstore/features/danmaku/api.ts:18`：`ReadAllType` 增 `"gift"`（`type ReadAllType = "super_chat" | "guard_buy" | "gift";`），注释同步。
3. **测验证**（并入步骤 3/4 前端用例或契约解析用例）：`ReadAllType` 含 `"gift"`（TS 层编译即校验；若契约有解析测试则断言 enum 含 gift）。

**验证**：`pnpm -C apps/bookstore lint` 绿；契约 YAML 合法（`pnpm -C servers/api test -- liveEvents` 若读契约则绿）。

### 步骤 2：后端 read-all 支持 gift + 上游展开（TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md`。改动 `servers/api/src/routes/liveEvents.ts`：

1. **测试先行** `servers/api/tests/liveEvents.test.ts`（或新增 `liveEventsReadAll.test.ts`，复用现有 read-all 用例注入风格）：
   - `type=gift` → 200；断言对 `deps.upstream.fetchRange` 传入的 upstream 类型为 `["gift", "gift_v2"]`（展开断言）且最终 `markAllRead` 写 `watermark` type 为 `"gift"`（或断言 db mock 收到 `"gift"`）；
   - `type=gift_v2`、`type=danmaku`、`type=online_rank_count`、非法 `type="unknown"` → 400（白名单之外）；
   - 礼物上游无事件（空 items）→ 200 `{ ok:true, marked:0 }` 且不写水位线；
   - 既有 super_chat / guard_buy 用例保持绿（回归）。
2. **实现** `liveEvents.ts`：
   - `:12` `READ_ALL_TYPES = ["super_chat", "guard_buy", "gift"]`；
   - `:300` read-all 的 `fetchRange([type], 1, READ_ALL_PAGE_SIZE)` 改为 `fetchRange(toUpstreamTypes([type]), 1, READ_ALL_PAGE_SIZE)`（复用既有 `:46` `toUpstreamTypes`，礼物展开为 `["gift","gift_v2"]`）；
   - `:313` `markAllRead(type, ...)` 不变（写 `watermark:gift`），`typeFromEventId`/数据模型无需改动。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test -- liveEvents` 全绿。

### 步骤 3：前端「礼物 全部已读」入口（ReadAllType + MarkReadButtonGroup，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`。改动 `apps/bookstore/features/danmaku/api.ts`、`apps/bookstore/features/danmaku/components/MarkReadButtonGroup.tsx`：

1. **测试先行** 更新 `apps/bookstore/tests/unit/danmaku-mark-read-button-group.test.tsx`：
   - admin 下平铺含「礼物 全部已读」按钮（`READ_ALL_LABELS.gift`）；二次确认后触发 `onReadAll("gift")`（复用既有 `super_chat`/`guard_buy` 二次确认用例风格）；
   - 折叠为 dropdown 时「礼物 全部已读」可操作（点击 → 确认 → `onReadAll("gift")`）；
   - `itemCount` 3（readAll 3 + 隐藏钢镚 1）：`shouldCollapse` 在 `containerWidth` 介于旧 neededWidth 与新增 neededWidth 之间时折叠，新增后同宽应折叠（断言折叠与否翻转）；
   - member（非 admin）下无「礼物 全部已读」（按钮组仅隐藏钢镚，`itemCount = 0 + 1 = 1`）。
2. **实现** `MarkReadButtonGroup.tsx`：
   - `:10-13` `READ_ALL_LABELS` 加 `gift: "礼物 全部已读"`；
   - `:79` `readAllTypes` 在 `canManage` 时含 `"gift"`：`canManage ? ["guard_buy", "super_chat", "gift"] : []`；
   - `:44` `itemCount` 由 `(canManage ? 2 : 0) + 1` 改为 `(canManage ? 3 : 0) + 1`（readAll 按钮数）；
   - 二次确认逻辑（`:66-77`）复用，无需改；`onReadAll` 透传 `DanmakuDashboard.handleReadAll`（经 `page.tsx:34 readAllFromRef` → `dashboardRef.current?.readAll(type)`，type 无关，天然支持 gift）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-mark-read-button-group` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 4：礼物单条已读接线（GiftItem + FeedSection，TDD）

改动 `apps/bookstore/features/danmaku/components/GiftItem.tsx`、`apps/bookstore/features/danmaku/components/FeedSection.tsx`：

1. **测试先行** 更新 `apps/bookstore/tests/unit/danmaku-items.test.tsx`（或 `danmaku-gift-item.test.tsx`）：
   - admin+（传入 `onToggleRead`）单击礼物条目根节点触发 `onToggleRead(event)`（`user-event` click 断言）；`event.read=true` 时根节点有 `opacity-60`；`title` 含「单击切换已读」；
   - 未传 `onToggleRead`（member）→ 单击不触发、无 `title`、无 `cursor-pointer`；
   - 礼物条目内 `Sender` 穿透：点击 Sender 不触发 `onToggleRead`（复用 `danmaku-sender.test.tsx` 或 items 内断言）。
   - `FeedSection` 用例：gift 分支在 `canManage=true` 时 `GiftItem` 收到 `onToggleRead`（可由 `danmaku-feed-section.test.tsx` 或通过 `danmaku-dashboard.test.tsx` 渲染断言）。
2. **实现** `GiftItem.tsx`：
   - `interface GiftItemProps { event: LiveEvent; onToggleRead?: (event: LiveEvent) => void; }`；
   - 根节点（`:17`）加 `onClick={onToggleRead ? () => onToggleRead(event) : undefined}`、`title={onToggleRead ? "单击切换已读" : undefined}`、`className` 追加 `event.read ? "opacity-60" : ""` 与 `onToggleRead ? "cursor-pointer" : ""`。
3. **实现** `FeedSection.tsx`：`:202` gift 分支改 `return <GiftItem event={event} onToggleRead={toggleRead} />;`（`toggleRead` 已按 `canManage` 归并）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-items danmaku-feed-section danmaku-dashboard` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 5：SC / 礼物 / 上船已读切换双击改单击 + title 更新（SuperChatItem / GuardItem，TDD）

改动 `apps/bookstore/features/danmaku/components/SuperChatItem.tsx`、`apps/bookstore/features/danmaku/components/GuardItem.tsx`（GiftItem 已在步骤 4 完成）：

1. **测试先行** 更新 `apps/bookstore/tests/unit/danmaku-items.test.tsx`：
   - admin+ 单击 SuperChatItem / GuardItem 根节点触发 `onToggleRead`（单击，非双击）；
   - `title` 为「单击切换已读」；
   - 双击语义等价测试（可选）：两次单击依次触发两次 toggle（第一次已读、第二次未读），最终回到初始 `read`；
   - member（未传 `onToggleRead`）无交互、无 title；
   - GuardItem 保留 `select-none`（文字不可选中），SC 根节点维持 `cursor-pointer`。
2. **实现**：
   - `SuperChatItem.tsx:29-30`：`onDoubleClick` → `onClick`；`title="单击切换已读"`；`:22`/`:dn` 注释同步「单击切换已读」；
   - `GuardItem.tsx:27-28`：`onDoubleClick` → `onClick`；`title="单击切换已读"`。
   （SC 留言文字区的单击已读在其后的步骤 6 实现，本步骤仅根节点非文字区。）

**验证**：`pnpm -C apps/bookstore test -- danmaku-items` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 6：SC 留言文字区单击已读 + 拖选区分 + 防重复 toggle（SuperChatItem，TDD）

改动 `apps/bookstore/features/danmaku/components/SuperChatItem.tsx`（决策 A：留言段自担单击已读 + `stopPropagation` 防根节点重复 toggle）：

1. **测试先行** 更新/新增 `apps/bookstore/tests/unit/danmaku-items.test.tsx`：
   - 单击 SC 留言 `<p>`（干净单击，`getSelection().isCollapsed === true`）→ 触发 `onToggleRead` **一次**（不因冒泡到根节点重复触发）；
   - **拖选**：mock `window.getSelection()` 返回 `{ type: "Range", isCollapsed: false }` → 单击留言不触发 `onToggleRead`（保留复制）；
   - 留言内 `BiliVideoLink` 链接点击 → 不触发 `onToggleRead`（穿透，断言 `onToggleRead` 未被调用）且打开链接（`href` 正确）；
   - SC 头部 `Sender`（头像/昵称）点击 → 不触发 `onToggleRead`；
   - 纯文本留言（无 BV 链接）：单击文字区触发 `onToggleRead`；
   - 含罗马音行：单击罗马音段亦触发（或与正文同域，取实现口径一致）。
2. **实现** `SuperChatItem.tsx`：
   - 留言 `<p>`（`:51-79`）移除 `onDoubleClick={(e) => e.stopPropagation()}`，改加 `onClick={handleMessageClick}`；
   - 新增 `handleMessageClick`：拖选判定——`const sel = window.getSelection(); if (sel && sel.type === "Range" && !sel.isCollapsed) return;`（拖选复制不触发）；干净单击则 `e.stopPropagation()` **并** `onToggleRead?.(event)`（`stopPropagation` 防止冒泡到根节点重复 toggle——一次单击仅 toggle 一次）；
   - 根节点 `onClick`（步骤 5）不变：非留言区点击由根节点 toggle；留言区点击由留言段处理并 stopPropagation；
   - 保留 `<p>` 的 `select-text`（可复制）；光标提示 `cursor-text` 与「可单击已读」语义以 cursor-pointer 优先（决策，见提案 §6 决策表）；内嵌 `BiliVideoLink`/`Sender` 依赖其自身 `onClick stopPropagation`（`BiliVideoLink.tsx:123`、`Sender.tsx:38`）不冒泡到留言段/根节点——**穿透不被吞**；
   - 注释（`:22`）同步「单击切换已读 + 留言文字区可单击已读、拖选不触发」。

**验证**：`pnpm -C apps/bookstore test -- danmaku-items danmaku-sender` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 7：穿透回归测试 + e2e 适配 + spec 同步 + 收尾验收

1. **穿透回归测试**（并入步骤 5/6 已覆盖）：若步骤 4/6 未覆盖「`Sender`/`BiliVideoLink` 点击不触发已读」的栏位级断言，补 `danmaku-dashboard.test.tsx` 一条验证：混排/单类型含 SC 的栏中，点击 SC 内 B 站视频链接与头像昵称均不触发该条目已读（穿透口径，任意含 SC 栏位一致）；
2. **e2e 适配**（SKILL: z-test，`tests/e2e/`）：既有弹幕看板 e2e 若断言「双击切换已读」/`title` 文案需适配为「单击切换已读」；如存在「SC 已读」e2e 且依赖双击则改为单击。无契约破坏（枚举扩容兼容），`live-events` 既有 API/e2e 保持绿；
3. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内、按开发分支落地时同步）：更新 `docs/product/spec/danmaku.md` 已读节（现态：单击切换已读、礼物已读（单条+全部）、SC 留言文字区单击已读且拖选不触发、SC 内 B 站链接点击/hover 与头像昵称跳转穿透、`read-all` type 枚举含 gift）；`docs/engineering/spec/`（`backend-rules.md` 相关或既有技术 spec）记录 `READ_ALL_TYPES` 含 gift 且 read-all 走 `toUpstreamTypes` 展开；PRD 与提案为时点文档，不改原文；
4. 检查 `apps/bookstore/AGENTS.md`「弹幕看板约定」「已读交互」段落是否需同步新口径（礼物已读、单击化、SC 留言区已读）；
5. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（礼物单条/全部已读、单击切换、SC 留言区单击已读 + 拖选不触发、B 站链接/头像昵称穿透不吞、member 无交互、既有能力零回归）；
6. 推送 `feat/danmaku-read-optimization` 并提 PR 至 `prd/danmaku-read-optimization`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：弹幕看板既有已读基建（`DanmakuDashboard.toggleRead` type 无关按 `eventId`、`markLiveEventRead/Unread`、`handleReadAll` 按 `e.type` 匹配）、`MarkReadButtonGroup`（二次确认/折叠）、`GiftItem`/`SuperChatItem`/`GuardItem`/`Sender`/`BiliVideoLink` 条目组件、`FeedSection.renderItem` 分发、后端 `toUpstreamTypes`/`markAllRead`/`typeFromEventId`（均已支持 gift）、`ReadAllType` 前端联合类型；`LiveEvent.gift`/`price` 既有契约字段。
- **并行协调**：单一开发分支 `feat/danmaku-read-optimization`；依赖链明确（契约 → 后端 → 前端类型/按钮组 → 礼物接线 → 单击化 → SC 留言区 → 穿透回归），subagent 串行；无 DB/编排变更。
- **风险**（对应提案 §5.2 与 §6.1）：
  - **根节点与留言段重复 toggle**：SC 根节点与留言段均 `onClick`，留言段点击会冒泡到根节点 → 一次单击 toggle 两次 = 无效果。决策 A：留言段 `handleMessageClick` 内 `e.stopPropagation()` 自担一次并阻断冒泡（提案实现点 2 风险③）；测试断言「留言区单击仅一次 toggle」；
  - **拖选判定依赖 `getSelection()`**：单测需 mock `window.getSelection()` 返回 Range 非折叠对象；实现用 `sel.type === "Range" && !sel.isCollapsed` 判定（提案实现点 2）；
  - **穿透被吞**：根节点改单击后，`BiliVideoLink`/`Sender` 的 `onClick stopPropagation`（`BiliVideoLink.tsx:123`、`Sender.tsx:38`）保证其点击不冒泡到留言段/根节点的已读 `onClick`。测试须覆盖「点链接/头像昵称不 toggle」（PRD F4，返工口径）；
  - **礼物全部已读展开遗漏**：read-all 若不走 `toUpstreamTypes`，仅查 `gift` 会漏 `gift_v2` 来源高水位（gift_v2 为主来源）。必须 `toUpstreamTypes([type])`（提案实现点 5 风险，后端测试断言 fetchRange 收到 `["gift","gift_v2"]`）；normalized 均归一为 `type:"gift"`，`handleReadAll` 按 `e.type === "gift"` 匹配天然覆盖两端来源；
  - **`ReadAllType` 增 `"gift"` 后 `READ_ALL_LABELS` 必须同步**：`MarkReadButtonGroup` 的 `Record<ReadAllType, string>` 缺 `gift` 会编译错误（TS 强制），防漏；`itemCount` 2→3 别遗漏，否则折叠判定窄屏不折叠溢出（提案实现点 5 风险③）；
  - **双击语义**：改为单击后双击 = 两次单击往返（第一次已读、第二次未读，回到初始），不再特判，可接受（PRD §六）；上船 `select-none` 保留；
  - **既有测试回归**：`danmaku-items.test.tsx`（双击→单击、SC 留言区、穿透）、`danmaku-mark-read-button-group.test.tsx`（礼物入口/折叠计数）、`danmaku-dashboard.test.tsx`（readAll gift）、后端 `liveEvents.test.ts`（read-all gift 展开）随步骤更新，避免红测试残留。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-23-danmaku-read-optimization-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-23-danmaku-read-optimization-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]、后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 契约：`contract/live-events.openapi.yaml`
- 参照实现方案：[[2026-08-23-danmaku-hover-bar-impl-plan.md]]（接线/收尾口径）、[[2026-08-22-danmaku-board-v3-impl-plan.md]]