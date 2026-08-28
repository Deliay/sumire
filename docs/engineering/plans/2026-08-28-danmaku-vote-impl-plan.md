---
description: 弹幕投票实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。唯一开发分支 feat/danmaku-vote，纯前端改动集中在 apps/bookstore：SideNav 追加「弹幕工具」入口，新增 /backdoor/danmaku-tools 卡片列表页与 /vote 投票工具页；新建 features/danmaku-tools/ 模块（types.ts Zod schema、match.ts 互斥校验与单选项命中纯函数、store.ts localStorage 损坏回退、useDanmakuVote.ts EventSource 状态机、四个薄渲染组件）；全部单测 TDD 落地，e2e 复用 danmaku.spec.ts 的 FakeEventSource 注入先例；契约/服务端/编排零变更。
type: Permanent
---

# 弹幕投票（弹幕工具一期）实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-28-danmaku-vote-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-28-danmaku-vote-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-vote`
**开发分支**: `feat/danmaku-vote`（自需求总分支切出，**唯一开发分支**，全部前端实现与测试同在此分支，纯前端，无服务端/契约/编排变更；与既有迭代同一口径）
**版本**: v1.0（2026-08-28）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支 `prd/danmaku-vote` 核对代码现态）：

- 导航：`apps/bookstore/features/backdoor/components/SideNav.tsx`——`NavItem { href, label, roles }`（`:11-15`）；`NAV_ITEMS` 现 5 项（`:17-23`，顺序：仪表盘/直播计划/弹幕看板/弹幕检索/用户管理）；选中态最长前缀匹配（`:30-32`，`pathname === href || pathname.startsWith(href + "/")`）。`/backdoor/danmaku-tools` 与 `/backdoor/danmaku` 互不误中（`-` 不是 `/`）；vote 子路径自然高亮「弹幕工具」项，无需改逻辑。新增后须同步 `apps/bookstore/AGENTS.md:51` 的「NAV_ITEMS 当前 5 项」记录。
- API 基础设施：`features/backdoor/api.ts`——`API_BASE_URL`（`:18`）、`API_CONFIGURED`（`:21`）、`Role`（`:1`）。
- 构建时守卫：`app/backdoor/layout.tsx:15-17`——`!API_CONFIGURED` 时直接渲染 `<NotFoundPage />`（**不是 `notFound()`**），覆盖整个 `(dashboard)` 组，**新页面无需各自做守卫**。
- 会话守卫：`app/backdoor/(dashboard)/layout.tsx:14-19` + `features/backdoor/session.tsx:68-78`，新页面放入 `(dashboard)/` 即被覆盖。
- 页面范例：`app/backdoor/(dashboard)/danmaku/search/page.tsx`——`"use client"`、`flex flex-col gap-6` 容器、`h1.font-serif text-2xl font-semibold text-ink` + `p.mt-1 text-ink-dim` 副标题（`:25-29`）；仪表盘页 `(dashboard)/page.tsx` 为无交互 Server Component（卡片列表页可照此写 SC）。
- SSE 先例：`features/danmaku/useLiveEventStream.ts`——`new EventSource(`${API_BASE_URL}/api/live-events/stream?${params}`, { withCredentials: true })`（`:46-50`）；danmaku 为**无名 `data:` 帧**，`es.onmessage` 内 `LiveEventSchema.safeParse(JSON.parse(msg.data))` 失败静默忽略（`:53-64`）；断线由 EventSource 内建自动重连（`:13,52`）；卸载 `es.close()`（`:74`）。本功能**不复用**该 hook（耦合看板去重/分发），仅参照其连接口径。
- 事件类型：`features/danmaku/types.ts`——`LiveEventSchema`（`:37-66`）直接复用；**`sender.uid` 是 `z.number().int()`（`:19`，number 非 string）**；**`content: z.string().optional()`（`:42`，契约 required 不含 content，`contract/live-events.openapi.yaml:269`）**——表情弹幕无 `content` 时必须跳过匹配但仍计入已处理；契约帧格式：无名 `data: <LiveEvent JSON>\n\n`（`live-events.openapi.yaml:112`），命名帧仅 `online_rank_count`，订阅 `type=danmaku` 不受影响。
- localStorage 先例：`features/danmaku/columns.ts`（`getStorage()` SSR 守卫 `:49-52`、`safeParse` 回退 `:54-62`）与 `mergeEnabled.ts`（同构简版 `:9-24`）；key 前缀惯例 `danmaku-backdoor.*`，本期按提案用 `danmaku-tools.vote`；单测用 `// @vitest-environment jsdom` pragma + `beforeEach(window.localStorage.clear())`（`tests/unit/danmaku-merge-enabled.test.ts:1,10-12`），**无手写 mock**。
- 测试组织：`apps/bookstore/vitest.config.ts:5-16`（默认 node 环境、`tests/unit/**/*.test.{ts,tsx}`、`@` alias）；**hook 测试先例** `tests/unit/danmaku-stream.test.tsx`（`renderHook` + `MockEventSource` 类 `:5-40` + `vi.stubGlobal("EventSource", …)`）；组件测试先例 `tests/unit/schedule-day-detail-dialog.test.tsx`。
- e2e 先例：`tests/e2e/src/backdoor/helpers.ts:5-13` `loginViaUi`；**SSE 伪造先例** `tests/e2e/src/backdoor/danmaku.spec.ts:108-183`——`page.addInitScript` 注入 `FakeEventSource`（替换构造器，非 route 拦截 text/event-stream），暴露 `window.__pushLiveEvent` / `__pushNamedEvent`；新 spec 复制该 stub 结构，不改动既有 spec。
- 弹窗口径：**无 modal 确认弹窗先例**（既有二次确认均为行内按钮态切换）；最近 modal 先例 `features/danmaku/components/GiftCardDialog.tsx:21-38,50-52,64-66`（Esc 关闭 + body 锁滚动 + 遮罩点击关闭 + `role="dialog" aria-modal`），`CreateUserDialog.tsx:58-67` 同构无 Esc。`ClearVoteDialog` 仿 GiftCardDialog 模式实现。
- 色 token：`app/globals.css:9-33` 全表；主按钮 `bg-primary text-ink-on-paper`（`features/backdoor/components/PrimaryButton.tsx:16`）；**无专用危险色 token**，`--color-crimson: #e06a7a`（`globals.css:32`）现仅用于总督红/礼物高价。**定夺**：「停止投票」态与清空确认按钮使用 `crimson` token（提案 §5.2 已定方向，本期确立该用法），不新增 token、不硬编码色值。
- 依赖：`apps/bookstore/package.json`——`zod ^4.4.3`（**Zod v4** 口径）、`@testing-library/react ^16.3.2`（内置 `renderHook`，无 react-hooks 包）；`crypto.randomUUID` 前端无先例（仅后端 `servers/api/src/session/store.ts:33`），浏览器/Node ≥19 原生支持，可直接用。

整体顺序（**串行**，唯一开发分支 `feat/danmaku-vote`，依赖链明确：纯函数 → 存储 → 状态机 hook → 组件/页面 → e2e 收尾）：
**切开发分支 → types.ts + match.ts（TDD）→ store.ts（TDD）→ useDanmakuVote.ts（TDD）→ 四个渲染组件（TDD）→ 页面与 SideNav 接线 → e2e + spec/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 弹幕工具入口 | 无；工具直挂导航 | SideNav 新增「弹幕工具」，`/backdoor/danmaku-tools` 卡片列表页（本期一张卡片） |
| 弹幕投票 | 无 | `/backdoor/danmaku-tools/vote`：选项管理（名称+关键字必填、双向子串互斥）、开始/停止投票（SSE 生命周期）、实时统计与比例 table、localStorage 持久化、二次确认清空 |
| 弹幕数据通道 | `/api/live-events/stream` 已交付 | 零契约变更，`EventSource` 订阅 `type=danmaku` 无名帧 |
| 计票规则 | 无 | 恰好单选项命中才计票 + 同一 `sender.uid`（number）全场只计 1 票 |
| 持久化 | 无 | localStorage key `danmaku-tools.vote`，Zod 校验损坏回退空态；`voting` 不持久化 |

契约（`contract/*`）、服务端（`servers/api`）、编排（`infra/aspire`）零变更。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/danmaku-vote`；
- 开发工作（前端实现 + 单元测试 + e2e）全部在**唯一开发分支** `feat/danmaku-vote` 上进行（自 `prd/danmaku-vote` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/danmaku-vote` 切出 `feat/danmaku-vote` 并推送 origin。

**验证**：`git branch --show-current` 为 `feat/danmaku-vote`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：投票数据模型与匹配纯函数（types.ts + match.ts，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。新建 `apps/bookstore/features/danmaku-tools/vote/types.ts` 与 `match.ts`（对应提案 §4、§5.2 实现点 1）：

1. **types.ts**（Zod v4 口径）：
   ```ts
   export const voteOptionSchema = z.object({
     id: z.string().min(1),          // crypto.randomUUID()
     name: z.string().min(1),        // 展示名称（写入前已 trim）
     keyword: z.string().min(1),     // 匹配关键字（写入前已 trim）
     count: z.number().int().min(0),
   });
   export const voteStateSchema = z.object({
     options: z.array(voteOptionSchema),
     processed: z.number().int().min(0),
     matched: z.number().int().min(0),
     voterUids: z.array(z.number().int()),  // sender.uid 为 number
   });
   export type VoteOption = z.infer<typeof voteOptionSchema>;
   export type VoteState = z.infer<typeof voteStateSchema>;
   export const EMPTY_VOTE_STATE: VoteState = { options: [], processed: 0, matched: 0, voterUids: [] };
   ```
2. **match.ts**（无依赖纯函数）：
   - `matchVote(content: string, options: VoteOption[]): string | null`——`options.filter(o => content.includes(o.keyword))` 长度恰好 1 时返回该 `option.id`，0 或 ≥2 返回 `null`（≥2 为互斥校验的防御兜底）；
   - `hasKeywordConflict(keyword: string, existing: VoteOption[]): boolean`——双向子串判定 `existing.some(o => o.keyword.includes(keyword) || keyword.includes(o.keyword))`，完全相同天然命中；
   - 大小写不折叠，按原样 `includes`（提案 §5.2 已定）。

**测试先行** 新建 `apps/bookstore/tests/unit/danmaku-vote-match.test.ts`：
- `matchVote`：恰好单命中返回选项 id；0 命中返回 null；多命中返回 null；关键字在弹幕任意位置命中；空 options 返回 null；
- `hasKeywordConflict`：A vs AA、AA vs A、完全相同、无冲突（如「唱歌」vs「游戏」）、多既有选项任一冲突即 true；
- `voteStateSchema`：合法状态通过；`count` 负数 / `voterUids` 非整数 / 缺字段拒绝。

**验证**：`pnpm -C apps/bookstore test -- danmaku-vote-match` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 2：localStorage 持久化（store.ts，TDD）

新建 `apps/bookstore/features/danmaku-tools/vote/store.ts`（对应提案 §5.2 实现点 3，仿 `mergeEnabled.ts`/`columns.ts` 结构）：

1. key 常量 `VOTE_STORAGE_KEY = "danmaku-tools.vote"`；`getStorage()` SSR 守卫（`typeof window === "undefined"` 返回 null）；
2. `loadVoteState(): VoteState`——读 key，`JSON.parse` + `voteStateSchema.safeParse`，任一步失败/异常返回 `EMPTY_VOTE_STATE` 的拷贝（损坏回退空态，不报错崩溃）；
3. `saveVoteState(state: VoteState): void`——`JSON.stringify` 写入（`voterUids` 已是数组，直接序列化）；存储不可用（SSR/隐私模式抛错）时静默跳过；
4. `clearVoteState(): void`——`removeItem`。

**测试先行** 新建 `apps/bookstore/tests/unit/danmaku-vote-store.test.ts`（`// @vitest-environment jsdom` + `beforeEach(() => window.localStorage.clear())`）：
- save/load 往返一致（含 options/voterUids）；
- 无 key 时 load 返回空态；非法 JSON 回退空态；结构不符（缺字段/类型错误）回退空态；
- clear 后 load 为空态；返回的空态是拷贝（改动返回值不污染 `EMPTY_VOTE_STATE`）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-vote-store` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 3：投票状态机 hook（useDanmakuVote.ts，TDD）

新建 `apps/bookstore/features/danmaku-tools/vote/useDanmakuVote.ts`（对应提案 §5.2 实现点 2）：

1. **状态**：`state: VoteState`（useState，初始 `EMPTY_VOTE_STATE`）+ `voting: boolean` + `hint: string | null`（操作提示：空选项开始、添加被拒等）；**挂载后经 `useEffect(() => setState(loadVoteState()), [])` 恢复持久化数据**（避免 `useState(() => load())` 造成 hydration 不一致——页面经 SSR 渲染，持久化数据只在客户端存在）；
2. **uid 判定**：`voterSetRef = useRef(new Set<number>())`——`useEffect` 随 `state.voterUids` 重建；事件回调中只经 ref 查改，杜绝闭包旧值；
3. **持久化**：`useEffect(() => { if (hydrated) saveVoteState(state); }, [state])`——挂载恢复前不回写（以 `hydratedRef` 标记，防止初始空态覆盖已有持久化数据）；`voting` 不持久化（刷新视为已停止，提案 §4 已定）；
4. **addOption(name, keyword)**：trim 后任一空 → 置 hint 拒绝；`hasKeywordConflict` 命中 → 置 hint 拒绝；成功则追加 `{ id: crypto.randomUUID(), name, keyword, count: 0 }` 并清 hint；`voting` 中拒绝（组件层亦禁用，双保险）；
5. **removeOption(id)**：`voting` 中拒绝；否则移除（其票数一并移除，`matched` 不回溯——删除的是配置不是历史；与「停止后可编辑」口径一致，删除已计票选项时 `matched` 保持原值，table 该选项行消失）；
6. **start()**：`state.options.length === 0` → 置 hint「请先添加投票选项」不建连；`!API_CONFIGURED` → 拒绝（页面已被构建时守卫拦截，双保险）；否则 `new EventSource(`${API_BASE_URL}/api/live-events/stream?type=danmaku`, { withCredentials: true })`，`es` 存 ref，`setVoting(true)`、清 hint；
7. **onmessage**（无名帧）：`JSON.parse` 失败忽略；`LiveEventSchema.safeParse`（复用 `features/danmaku/types.ts`）失败忽略；`type !== "danmaku"` 忽略；之后 `processed += 1`；`content === undefined`（表情弹幕）不匹配；`matchVote(content, options)` 命中且 `!voterSetRef.current.has(sender.uid)` → 该选项 `count += 1`、`matched += 1`、`voterSet.add(uid)`；每次事件后 setState（持久化由 [state] effect 统一回写）。**不做 eventId 去重**：uid 唯一性已保证不重复计票，重连回放仅可能虚增 `processed`，接受该口径；
8. **stop()**：`esRef.current?.close()`、置 null、`setVoting(false)`，统计保留；
9. **clear()**（由确认弹窗确认后调用）：先 `stop()` 同等断开，再重置 `EMPTY_VOTE_STATE`（同步清空 `voterSetRef`）+ `clearVoteState()`——清空蕴含停止；
10. **卸载清理**：`useEffect` return 中 `es.close()`，路由切换即断开。

**测试先行** 新建 `apps/bookstore/tests/unit/danmaku-vote-hook.test.tsx`（jsdom pragma；仿 `danmaku-stream.test.tsx` 的 `MockEventSource` 类 + `vi.stubGlobal("EventSource", …)`，`renderHook` + `act`）：
- 初始为空态；预置 localStorage 后挂载恢复（options/processed/matched/voterUids 一致）且 `voting === false`；
- addOption：空名称/空关键字/纯空白拒绝 + hint；冲突关键字（A 后加 AA、AA 后加 A、完全相同）拒绝 + hint；合法添加成功；voting 中拒绝；
- start：无选项拒绝且不构造 EventSource + hint；有选项建立连接且 URL 含 `type=danmaku`、`withCredentials: true`；`voting === true`；
- 计票：单命中弹幕 → 选项 count +1、matched +1、processed +1；同一 uid 再次命中 → 仅 processed +1；首条未命中、次条命中 → 正常计票；0 命中/多命中 → 仅 processed +1；无 `content` 的表情弹幕 → 仅 processed +1；`type !== "danmaku"` / 非法 JSON → processed 不变；
- stop：EventSource 实例 `close()` 被调、`voting === false`、统计保留；再次 start 在既有数据上累计（voterUids 保留）；
- clear：断开连接 + 全量空态 + localStorage 已清除；
- 卸载：close 被调；状态变更后 localStorage 已回写（save 语义）。

**验证**：`pnpm -C apps/bookstore test -- danmaku-vote-hook` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 4：薄渲染组件（components/，TDD）

新建 `apps/bookstore/features/danmaku-tools/` 下组件（对应提案 §5.2 实现点 4；加载 `docs/design/03-backdoor-design.md`，仅 `@theme` token、过渡 ≤200ms、尊重 `prefers-reduced-motion`）：

1. **`ToolCard.tsx`**：名称 + 一句话简介，整卡 `Link` 包裹跳转；卡片样式沿用后台纸面 token（`bg-raised`/`border-vine` 系，hover 态与既有卡片一致）；
2. **`vote/components/VoteOptionsEditor.tsx`**：选项列表行（名称 + 关键字 + 删除按钮）+ 新增表单（「名称」「匹配关键字」两输入 + 「添加选项」按钮）+ hint 提示区（`role="alert"`）；`voting` 中全部输入与删除按钮 `disabled`；
3. **`vote/components/VoteControlBar.tsx`**：「开始投票/停止投票」双态按钮——开始态 `bg-primary text-ink-on-paper`（沿用 `PrimaryButton` 口径），停止态换用 `bg-crimson text-ink-on-paper`（本期确立的警示色用法，token 不硬编码）；旁置「清空投票」次按钮（`rounded-md border border-vine/50` 次级样式，同 search 页「返回看板」Link 口径）；hook 的 hint 在此区展示；
4. **`vote/components/VoteStatsTable.tsx`**：统计文案「已处理 {processed} 条弹幕，其中 {matched} 条匹配」+ 语义化 `<table>`（`<caption>` 或 `aria-label`；列：名称/票数/占比）；占比 = `count / 总票数`，`(ratio * 100).toFixed(1) + "%"`；**总票数为 0 时各选项占比显示 `0%`**；
5. **`vote/components/ClearVoteDialog.tsx`**：仿 `GiftCardDialog.tsx` 模式——`fixed inset-0 z-50` 遮罩（`bg-black/50`）、`role="dialog" aria-modal="true" aria-labelledby`、Esc 关闭、点击遮罩取消、打开时 body 锁滚动、打开后焦点落于「取消」按钮（既有无焦点陷阱先例，保持轻量）；文案明确「将清空当前所有投票数据（选项、统计与已投票记录），是否确认？」；「确认清空」按钮用 `crimson` 警示色、「取消」次级样式。

**测试先行** 新建 `apps/bookstore/tests/unit/danmaku-vote-components.test.tsx`（jsdom pragma，Testing Library）：
- `VoteOptionsEditor`：空值/冲突时添加被拒且 hint 可见（以受控 props 驱动，断言回调未被调或 hint 文案渲染）；`voting` 时输入与按钮 disabled；删除按钮触发回调；
- `VoteControlBar`：双态文案切换（开始投票 ↔ 停止投票）；两态类名不同且停止态含 `bg-crimson`；清空按钮触发回调；
- `VoteStatsTable`：计数文案正确；占比计算（如 3/1 票 → 75.0%/25.0%）；总票数 0 → 全部 `0%`；
- `ClearVoteDialog`：`open` 时渲染 `role="dialog"` 与警示文案；确认/取消回调分支；Esc 触发取消；遮罩点击触发取消。

**验证**：`pnpm -C apps/bookstore test -- danmaku-vote-components` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 5：页面与导航接线

1. **SideNav.tsx**：`NAV_ITEMS` 在「弹幕检索」之后追加 `{ href: "/backdoor/danmaku-tools", label: "弹幕工具", roles: ["superadmin", "admin", "member"] }`；扩展 `tests/unit/backdoor-sidenav.test.tsx`——新项渲染、全角色可见、`/backdoor/danmaku-tools/vote` 路径下「弹幕工具」为选中态且不误中「弹幕看板」；
2. **`app/backdoor/(dashboard)/danmaku-tools/page.tsx`**：工具列表页，无交互写 Server Component（照 `(dashboard)/page.tsx` 口径）；页头 `h1`「弹幕工具」+ 副标题；卡片栅格（`grid gap-4 sm:grid-cols-2 lg:grid-cols-3`），本期一张 `ToolCard`（名称「弹幕投票」、简介「观众弹幕实时投票统计」、href `/backdoor/danmaku-tools/vote`）；
3. **`app/backdoor/(dashboard)/danmaku-tools/vote/page.tsx`**：`"use client"`；调用一次 `useDanmakuVote()` 下传分区渲染——页头（标题「弹幕投票」+ 副标题 + 右上「返回工具列表」Link，照 search 页口径）；`lg:grid-cols-2` 左右两栏、窄屏纵向堆叠：左侧 `VoteOptionsEditor` + `VoteControlBar`，右侧 `VoteStatsTable`；`ClearVoteDialog` 由页面持有 `clearDialogOpen` 状态，确认时调 hook 的 `clear()`；
4. 构建时守卫 / 会话守卫均由上层 layout 覆盖，页面不各自处理。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；本地 `aspire start` 后手工走查：导航入口 → 列表页卡片跳转 → 添加选项（含冲突拒绝）→ 开始/停止投票双态 → 统计实时更新 → 刷新保留 → 清空确认弹窗。

### 步骤 6：e2e、Spec 同步与收尾验收

1. **e2e**（SKILL: z-test）新建 `tests/e2e/src/backdoor/danmaku-vote.spec.ts`：`loginViaUi` 登录（member 账号即可，验证全角色可见）→ 导航出现「弹幕工具」→ 列表页卡片跳转 vote 页 → 添加两个选项（含一次冲突拒绝断言）→ 复制 `danmaku.spec.ts:108-183` 的 `FakeEventSource` init-script stub（不改既有 spec）→ `window.__pushLiveEvent` 推送伪造弹幕（单命中/重复 uid/无 content 表情/未命中各若干）→ 断言统计文案与比例 table → 停止投票 → 刷新页面断言数据保留 → 清空投票（先取消断言无变化，再确认断言回到空态）；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：
   - `docs/product/spec/backdoor.md`：补「弹幕工具」区现态（导航入口、卡片列表页、弹幕投票工具的功能口径）；
   - `docs/engineering/spec/frontend-bookstore.md`：补 `features/danmaku-tools/` 模块现态（types/match/store/useDanmakuVote/组件、localStorage key、计票口径）；
   - `apps/bookstore/AGENTS.md:51`：NAV_ITEMS 5 项 → 6 项记录同步；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；`pnpm lint && pnpm test && pnpm build`（apps/bookstore）与 e2e 全绿；
4. 推送 `feat/danmaku-vote` 并提 PR 至 `prd/danmaku-vote`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：既有 `/api/live-events/stream`（type=danmaku，无名帧，`sender.uid` 为 number，`content` 可选）；`features/backdoor/api.ts`（`API_BASE_URL`/`API_CONFIGURED`）；`features/danmaku/types.ts` `LiveEventSchema`；`(dashboard)` 会话守卫与 `app/backdoor/layout.tsx` 构建时守卫；Zod v4；`crypto.randomUUID`（浏览器/Node ≥19 原生）。
- **并行协调**：唯一开发分支 `feat/danmaku-vote`；依赖链明确（纯函数 → 存储 → hook → 组件 → 页面），subagent 串行；契约/服务端/编排零变更，无可并行后端任务。
- **风险**（对应提案 §5.2 与核对发现）：
  - **`content` 可选**：契约 required 不含 `content`，表情弹幕必须跳过匹配但仍计入 `processed`（PRD F4 口径）；`sender.uid` 为 number，`voterUids`/`Set` 用 number 键，勿按 string 处理；
  - **hydration 不一致**：持久化数据仅客户端存在，必须挂载后 `useEffect` 恢复（非 `useState` 惰性初始化），且恢复前不回写存储（`hydrated` 标记防初始空态覆盖）；
  - **闭包旧值**：EventSource 回调长生命周期，`voterSet`/options 判定必须经 ref 读最新值；
  - **写入压力**：每条弹幕触发 setState + localStorage 同步写，投票量级（条/s）可接受；卡顿再引入防抖，不预优化；
  - **重连回放**：不做 eventId 去重，uid 唯一性兜底不重复计票，`processed` 可能虚增——已确认接受；
  - **警示色新用法**：`crimson` 此前仅用于总督红/高价着色，本期确立其作为「停止/破坏性确认」按钮色的用法，不新增 token；
  - **e2e 环境**：SSE 走 `FakeEventSource` init-script 替身（既有先例），非真实流；计票正确性主要由 hook 单测保证，e2e 覆盖主流程与持久化。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-28-danmaku-vote-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-28-danmaku-vote-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/backdoor.md`、`docs/product/spec/danmaku.md`
- 契约：`contract/live-events.openapi.yaml`（本期零变更）
- 上一迭代实现方案参照：[[2026-08-24-weekly-image-date-render-impl-plan.md]]
