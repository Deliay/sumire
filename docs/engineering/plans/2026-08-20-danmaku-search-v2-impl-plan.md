---
description: 弹幕检索 v2 实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（纯前端：SideNav 新增「弹幕检索」一级菜单项 + 最长前缀匹配修复选中态；SearchResultCard 按 event.type 分发复用看板四类条目组件；SuperChatItem 新增可选 highlightKeyword；TDD 步骤、并行分工、验证与验收）
type: Permanent
---

# 弹幕检索 v2 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-20-danmaku-search-v2-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-20-danmaku-search-v2-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-search-v2`
**开发分支**: `feat/danmaku-search-v2`（自需求总分支合入 main 后自主线切出，**唯一开发分支**；提案页首口径）
**版本**: v1.0（2026-08-20）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。本期为**纯前端变更**：不改契约、不改服务端、无配置变更。前提事实（已在需求总分支核对代码现态）：

- `apps/bookstore/features/backdoor/components/SideNav.tsx:17-22`：`NAV_ITEMS` 现 4 项（仪表盘 `/backdoor`、直播计划、弹幕看板 `/backdoor/danmaku`、用户管理），`roles` 逐显式列出；`:33-36` 激活判定为 `/backdoor` 精确匹配、其余 `pathname.startsWith(item.href)`——若直接新增 `/backdoor/danmaku/search` 项，检索页会同时命中「弹幕看板」与「弹幕检索」双高亮，必须随菜单项一并改为最长前缀匹配；
- `apps/bookstore/features/danmaku/search/components/SearchResultCard.tsx:13-52`：现态对全部事件类型一律按 v1 弹幕卡片渲染（`Sender compact` + `splitByKeyword` `<mark class="rounded-sm bg-eye/30 px-0.5">` 高亮 + emote 渲染 + `formatOccurredAt` + `guardDanmakuTint` 淡色背景），卡片根宽度类 `w-full sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]`（`:19`）——本期改为按 `event.type` 分发；
- 看板四类条目组件（分发示例 `FeedSection.tsx:108-122` 的 `renderItem`）：`DanmakuItem`（`{ event, count }`）、`SuperChatItem`（`{ event, isNew?, onToggleRead? }`，`SuperChatItem.tsx:9-15`）、`GiftItem`（`{ event }`，`GiftItem.tsx:8-10`）、`GuardItem`（`{ event, isNew?, onToggleRead? }`，`GuardItem.tsx:7-13`）——`onToggleRead` 缺省即只读（无 dblclick、无 `cursor-pointer`，member 口径已是此行为）；
- `SuperChatItem.tsx:47-68`：留言气泡渲染分支——`hasBiliLink(content)` 时走 `BiliVideoLink` 链接化，否则纯文本；`contentRomaji` 罗马音行独立 `block` 渲染（`:65-67`）；`event.read` 时 `opacity-60` 置灰（`:29`）；新增 `highlightKeyword` 入参不得扰动看板调用方输出；
- `search/highlight.ts:10-41`：`splitByKeyword`（`indexOf` 朴素子串切分、大小写不敏感、连续命中合并、空关键词/未命中返回单段）可直接复用于 SC 留言高亮，零改动；
- 检索页装配：`SearchResults.tsx:78-82` 以 `flex flex-wrap gap-3` 容器逐事件渲染 `<SearchResultCard event keyword>`，`keyword` 来自 `useDanmakuSearch` 的 `criteria`（`search/page.tsx:46`）——分发改造只动 `SearchResultCard`，容器与 hook 零改动；
- 单测基底：`apps/bookstore/tests/unit/` 已有 `backdoor-sidenav.test.tsx`（导航选中态用例就地扩展）、`danmaku-items.test.tsx`（条目组件用例）、`danmaku-search-highlight.test.ts`（`splitByKeyword` 已覆盖，本期无新增高亮纯函数）；e2e `tests/e2e/src/backdoor/danmaku.spec.ts`（`stubLiveEvents` 已支持 `/api/live-events/search` 分支，v1 已交付）与 `dashboard.spec.ts`（导航相关断言需核对补充）；
- 无契约变更：`GET /api/live-events/search`（v1 已交付）响应 `LiveEvent[]` 自带 `type` 四值枚举（`danmaku`/`super_chat`/`gift`/`guard_buy`，`features/danmaku/types.ts`），前端分发无需新增字段。

整体顺序：**切开发分支 → 前端实现（TDD，导航与结果卡片两个 subagent 并行）→ e2e → 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|---------------------------------------|
| 后台导航 | 4 项，无「弹幕检索」；检索入口仅看板页头链接 | 「弹幕看板」后新增「弹幕检索」一级菜单项（`/backdoor/danmaku/search`，superadmin/admin/member 可见） |
| 导航选中态 | `/backdoor` 精确匹配 + 其余 `startsWith` 前缀 | 统一最长前缀匹配：候选取 `pathname === href \|\| pathname.startsWith(href + "/")`，激活 `href` 最长者；看板/检索两页互不双高亮 |
| 检索结果渲染 | 全类型一律 v1 弹幕卡片 | 按 `event.type` 分发：`danmaku` 保持 v1 卡片、`super_chat` → `SuperChatItem`（+ 关键词高亮）、`gift` → `GiftItem`、`guard_buy` → `GuardItem`；未知类型兜底 v1 卡片不抛错 |
| SC 关键词高亮 | 无（SC 被当弹幕卡片渲染） | `SuperChatItem` 新增可选 `highlightKeyword`，非空时留言正文命中子串包 `<mark>`；罗马音行不高亮；看板调用方零改动 |
| 只读口径 | v1 卡片本无可读交互 | 分发型条目不传 `onToggleRead`、`isNew=false`：无双击已读、无「New」标记、无合并计数 |
| 测试 | 三层测试全绿 | 增量：SideNav 选中态/可见性单测、SearchResultCard 分发单测、SuperChatItem 高亮两路径单测、e2e 导航入口与选中态；既有用例零适配 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-search-v2`；
- 开发工作全部在**唯一开发分支** `feat/danmaku-search-v2` 上进行（按提案口径：需求总分支合入 main 后自主线切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 确认 `prd/danmaku-search-v2` 合入 main（含 PRD v1.0、提案 v1.0 与本文档），自主线切出 `feat/danmaku-search-v2`。

**验证**：`git status` 干净，位于 `feat/danmaku-search-v2`。

### 步骤 1：SideNav 菜单项与选中态修复（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`（注意 AGENTS.md 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南）。全程 TDD，先扩 `apps/bookstore/tests/unit/backdoor-sidenav.test.tsx` 再改实现：

1. **测试先行**：`backdoor-sidenav.test.tsx` 新增用例——
   - pathname `/backdoor/danmaku/search` 时仅「弹幕检索」呈选中态（「弹幕看板」不选中）；
   - pathname `/backdoor/danmaku` 时仅「弹幕看板」呈选中态；
   - 既有路径回归：`/backdoor`、`/backdoor/schedule`、`/backdoor/users`（含子路径如 `/backdoor/users/xxx`）各自仅命中对应项；
   - member 角色渲染可见「弹幕检索」项；菜单顺序为「弹幕看板」之后；
2. **实现** `features/backdoor/components/SideNav.tsx`：
   - `NAV_ITEMS` 在「弹幕看板」后插入 `{ href: "/backdoor/danmaku/search", label: "弹幕检索", roles: ["superadmin", "admin", "member"] }`；
   - 激活判定改为最长前缀匹配：候选为 `pathname === item.href || pathname.startsWith(item.href + "/")` 的可见项，取 `href` 最长者激活（`/backdoor` 精确匹配规则被该口径自然覆盖，删除现有 `:34-35` 特例）；
   - 样式与结构零改动（沿用 `border-l-[3px]` 选中描边与 `aria-label="后台导航"`）。

**验证**：`pnpm -C apps/bookstore test -- backdoor-sidenav` 与 `pnpm -C apps/bookstore lint` 全绿。

### 步骤 2：SearchResultCard 按类型分发 + SuperChatItem 高亮入参（subagent，TDD，可与步骤 1 并行）

加载规范同步骤 1。全程 TDD：

1. **测试先行**：
   - 新增 `apps/bookstore/tests/unit/danmaku-search-result-card.test.tsx`——四类型分别渲染为对应组件结构（danmaku 卡片含 `<mark>` 高亮与 emote 分支；super_chat 含金额与渐变气泡；gift 含「礼物」chip 与数量；guard_buy 含「上船 · 船名」chip）；未知类型（构造 `type` 越界的 `LiveEvent`）兜底 danmaku 卡片不抛错；非弹幕类型均不渲染 `onDoubleClick` 交互与「New」标记；
   - `danmaku-items.test.tsx` 扩展（或就近新增用例）——`SuperChatItem` 传 `highlightKeyword` 时留言命中子串包 `<mark>`、罗马音行无 `<mark>`；不传时输出与现态一致（看板零回归）；
2. **实现** `features/danmaku/components/SuperChatItem.tsx`：
   - 新增可选入参 `highlightKeyword?: string`（缺省 `undefined`）；
   - 非空且 `content` 存在时：留言正文改用 `splitByKeyword(content, highlightKeyword)` 切分渲染，命中段包 `<mark className="rounded-sm bg-eye/30 px-0.5">`（与 v1 检索卡片同款 token 样式）；此分支下 `BiliVideoLink` 链接化让位于高亮（检索场景以高亮为先，纯文本分段渲染）；`contentRomaji` 行保持原样不高亮；
   - `highlightKeyword` 缺省时渲染输出与现态逐字节一致；
3. **实现** `features/danmaku/search/components/SearchResultCard.tsx`：改为分发器——
   - 现有 v1 卡片 JSX 抽为文件内局部 `DanmakuCard`（含 `Sender compact`/高亮/emote/时间/`guardDanmakuTint`，行为逐字节不变）；
   - `switch (event.type)`：`danmaku` → `DanmakuCard`；`super_chat` → `<SuperChatItem event={event} highlightKeyword={keyword} />`（不传 `onToggleRead`，`isNew` 用缺省 `false`）；`gift` → `<GiftItem event={event} />`；`guard_buy` → `<GuardItem event={event} />`；`default` → `DanmakuCard`（防御未知类型）；
   - 非 danmaku 分支外套与 v1 卡片同宽的容器 `<div className="w-full sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]">`，保证瀑布流栅格一致；条目组件自带竖条/背景，容器不叠加卡片底色与 tint；
   - **只读口径说明**：复用条目组件保留 `event.read` 置灰（`opacity-60`）等看板渲染口径，「只读」仅指无已读交互/无 New 标记/无合并计数，渲染特征与看板一致正是本期目标；
4. 视觉约束：仅 `@theme` token 色（禁硬编码）；过渡 ≤200ms。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；既有看板相关单测（`danmaku-items`/`danmaku-feed-section`/`danmaku-dashboard` 等）零适配通过。

### 步骤 3：e2e（subagent，SKILL: z-test，步骤 1/2 就绪后）

加载 `tests/e2e/AGENTS.md`。在既有 spec 上增量扩展：

- `tests/e2e/src/backdoor/danmaku.spec.ts`：
  - 新增用例（命名 `danmaku-search-v2-<slug>: 中文描述`）：登录后左侧导航可见「弹幕检索」且位于「弹幕看板」之后 → 点击进入 `/backdoor/danmaku/search` 且导航仅「弹幕检索」高亮 → 返回看板页，导航仅「弹幕看板」高亮；
  - stub 事件中加入 SC / 礼物 / 上船样本（`stubLiveEvents` 的 search 分支 v1 已具备），检索关键词命中混合结果：断言 SC 呈现金额与气泡样式、礼物呈现礼物名、上船呈现船型徽章、弹幕保持 `<mark>` 高亮卡片；
- 核对 `dashboard.spec.ts` 是否有导航项数量/顺序断言，如有则同步更新；
- 既有检索与看板用例全量回归。

**验证**：Aspire 编排（`cd infra/aspire && aspire start`，端点经 `aspire describe` 注入）下 `tests/e2e` 全量通过。

### 步骤 4：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`「弹幕检索」小节（入口提升为一级导航、按类型分发渲染、SC 高亮、只读口径现态）与 `docs/engineering/spec/frontend-bookstore.md`（SideNav 最长前缀匹配口径、`SearchResultCard` 分发器、`SuperChatItem.highlightKeyword` 入参）；PRD 与提案为时点文档，不改原文；
2. 更新 `apps/bookstore/AGENTS.md` 弹幕看板约定段：`SideNav` NAV_ITEMS 5 项（含「弹幕检索」）与最长前缀匹配口径、`features/danmaku/search/` 中 `SearchResultCard` 按类型分发、`SuperChatItem` 可选 `highlightKeyword`；
3. 核对 PRD §1.3 成功标准与提案 §10 验收标准逐条通过；
4. 推送 `feat/danmaku-search-v2` 并提 PR 至 `prd/danmaku-search-v2`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：弹幕检索 v1（已上线，`features/danmaku/search/` 模块与 `GET /api/live-events/search`）；看板四类条目组件与 `splitByKeyword`（均既有，零改动复用）；无新增 npm 依赖、无契约/服务端/配置/编排变更；
- **并行协调**：步骤 1（SideNav）与步骤 2（SearchResultCard/SuperChatItem）文件不相交，两个 subagent 并行；步骤 3 依赖两者就绪；步骤 4 串行收尾；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 直接保留 `startsWith` 会致检索页双高亮——最长前缀匹配随菜单项一并修复，单测锁定（步骤 1）；
  - 看板条目组件为整行信息流设计，放入定宽卡片列需目检 SC 渐变卡片窄列表现（内部已 `min-w-0`/`break-words`，预期正常；步骤 2 实现后人工目检一次三断点）；
  - SC 高亮与 `BiliVideoLink` 链接化互斥——检索场景高亮优先（步骤 2.2 口径），看板路径不传参输出逐字节不变，回归风险为零（单测锁定）；
  - 未知事件类型兜底 danmaku 卡片不抛错（`default` 分支 + 单测锁定，步骤 2.3）；
  - e2e stub 样本不含 SC/礼物/上船时混合类型断言无从谈起——步骤 3 必须扩充 mock 事件类型覆盖。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-20-danmaku-search-v2-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-20-danmaku-search-v2-proposal.md]]（v1.0）
- 前置实现方案（v1）：[[2026-08-20-danmaku-search-impl-plan.md]]
- 前端规范：[[../frontend-rules.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
