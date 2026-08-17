---
description: 弹幕看板二期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（单一开发分支 feat/danmaku-board-v2：契约 gift.iconUrl 先行，后端 normalizeGift 提取 img_basic，前端文案更名/二期默认分栏/GiftItem 图标/GuardItem 徽章特写，e2e 断言同步；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 弹幕看板二期 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-16-danmaku-board-v2-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-16-danmaku-board-v2-proposal.md]]（v1.0）
**关联契约**: `contract/live-events.openapi.yaml`（增补可选 `gift.iconUrl`，向后兼容）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-board-v2`
**开发分支**: `feat/danmaku-board-v2`（自需求总分支切出，**唯一开发分支**，契约与实现同在此分支）
**版本**: v1.0（2026-08-17）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `apps/bookstore/features/danmaku/columns.ts:12-26` 现态 `DEFAULT_COLUMNS` 为 3 栏「礼物 | SC+上船 混排（`sc_guard`） | 弹幕」、`COLUMN_PRESETS[2]` 为「SC+上船 混排 | 弹幕+礼物 混排」，与提案 §1.1 描述一致；`resolveColumns` 断点逻辑（narrow/medium/wide）与 `FeedColumn` 逐类型分节渲染均无需改动，预设调整为纯数据变更；
- `features/backdoor/components/SideNav.tsx:20` NAV_ITEMS label 为「弹幕后台」；`app/backdoor/(dashboard)/danmaku/page.tsx:21,46` 两处 h1 为「弹幕后台」；`tests/unit/backdoor-sidenav.test.tsx:15-37` 三处角色断言含「弹幕后台」；
- `contract/live-events.openapi.yaml:244-250` `gift` schema 仅 `name`/`count`；`servers/api/src/liveEvents/normalize.ts:206` `normalizeGift` 未提取 `img_basic`；夹具 `servers/api/tests/fixtures/live-events/gift.json` 未含 `img_basic`；
- `features/danmaku/format.ts:49` 既有 `guardBadgeAsset(level)` 纯函数（舰长/提督/总督三枚本地 PNG，一期头像挂件已生产使用），直接复用；`GuardItem.tsx:38` 船型 chip 现为 `text-[10px] leading-4 font-semibold`；
- e2e 现态断言需同步：`tests/e2e/src/backdoor/danmaku.spec.ts:240,260,263,364`（「弹幕后台」导航/标题）、`:265`（默认三栏注释与断言）、`:434-450`（SC+上船 栏默认混排与 `sc_guard` id 断言）、`unconfigured.spec.ts:35`（导航无「弹幕后台」入口断言）。

整体顺序：**切开发分支 → 契约增补（首批提交）→ 后端归一化（TDD）→ 前端实现（TDD）→ e2e 断言同步 → 收尾验收**。改动面小且集中，后端与前端两个实现 subagent 因共享 `feat/danmaku-board-v2` 分支**串行执行**（后端先行，前端依赖契约字段形态）。提案 §6.2「分支自 main 切出」以本文档为准：开发分支自需求总分支 `prd/danmaku-board-v2` 切出（其本身自 main 切出，含 PRD/提案/本文档），与一期口径一致。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 文案 | SideNav/页头/单测/e2e 均为「弹幕后台」 | 全部用户可见文案更名「弹幕看板」，路由 `/backdoor/danmaku` 不变；代码注释同步刷新 |
| 默认分栏 | 3 栏「礼物 \| SC+上船 混排 \| 弹幕」；2 栏「SC+上船 混排 \| 弹幕+礼物 混排」 | 3 栏「礼物 \| 上船+SC 分节（`guard_sc`） \| 弹幕」；2 栏「上船+SC 分节 \| 礼物+弹幕 混排」；1 栏不变；存量 localStorage 配置不迁移 |
| 契约 | `gift` 仅 `name`/`count` | 增补可选 `iconUrl`（上游 `data.img_basic` 透传，缺失不下发） |
| 归一化 | `normalizeGift` 无图标提取 | 提取 `data.img_basic` → `gift.iconUrl`，空串/缺失不含该字段 |
| 礼物条目 | 纯文字（chip + 名称×数量 + 价值） | 礼物名同行前置固定尺寸图标，`loading="lazy"`，onError/缺字段隐藏不破版 |
| 上船条目 | 船型色竖条 + chip + 条目打底 | chip 前置 16px 本地徽章（复用 `guardBadgeAsset`）+ 字号升一档，克制无动效；未知等级回退 |
| 测试 | 一期三层测试全绿 | 增量：归一化图标透传单测、前端预设/文案/图标三态/徽章特写单测、e2e 文案与预设断言同步；API 集成测试仅回归 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-board-v2`；
- 开发工作（契约、前后端实现、测试）全部在**唯一开发分支** `feat/danmaku-board-v2` 上进行（自 `prd/danmaku-board-v2` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-board-v2` 切出 `feat/danmaku-board-v2`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-board-v2`。

### 步骤 1：契约增补 `gift.iconUrl`（feat 分支首批提交）

按提案 §3.1 修改 `contract/live-events.openapi.yaml` 的 `gift` schema：`required` 不变（仍 `[name, count]`），追加可选属性 `iconUrl: { type: string, description: 礼物图标 URL（上游 data.img_basic；缺失时不下发该字段） }`。端点、参数、鉴权、错误结构零变更。

**验证**：YAML 语法合法；diff 仅 `gift` schema 一处增补，与提案 §3.1 逐字一致。

### 步骤 2：后端归一化（subagent，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md` 与契约。全程 TDD：先失败测试再实现。改动面：

1. 夹具 `servers/api/tests/fixtures/live-events/gift.json` 增补含 `data.img_basic` 的样本字段（值取可信 B 站静态资源 URL 形态，如 `https://s1.hdslb.com/...`）；
2. 单测先行：`tests/liveEventsNormalize.test.ts` 增补用例——携带 `img_basic` → `gift.iconUrl` 透传；字段缺失/空串 → 归一化结果不含 `iconUrl`；
3. `src/liveEvents/normalize.ts`：`normalizeGift` 内 `iconUrl = asString(data.img_basic)`，非空才写入 `gift` 对象；`LiveEvent` 类型 `gift` 增 `iconUrl?: string`（`normalize.ts:33`）；
4. 无路由/配置/编排变更（已读、检索、SSE 行为零改动）。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：前端实现（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与契约。注意 `apps/bookstore/AGENTS.md` 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。全程 TDD。改动面（对应提案 §5.2 实现点 1–4）：

1. **文案更名**：`SideNav.tsx:20` label「弹幕后台」→「弹幕看板」；`page.tsx:21,46` 两处 h1 同步；`backdoor-sidenav.test.tsx:15-37` 断言更新；代码注释（`page.tsx:8`、`ColumnCountSelector.tsx:17`、`types.ts:4`、`api.ts:5`、`DanmakuDashboard.tsx:55,63`、`format.ts:1`、`apps/bookstore/AGENTS.md:45-50`）随实现 PR 一并刷新；`grep -r "弹幕后台" apps/bookstore` 用户可见处归零（localStorage key `danmaku-backdoor.columns` **不变**——更名即强制清空存量配置，违反 PRD 不迁移口径）；
2. **二期默认分栏**（`columns.ts`）：`DEFAULT_COLUMNS` 中栏改为 `{ id: "guard_sc", types: ["guard_buy", "super_chat"], mode: "split" }`；`COLUMN_PRESETS[2]` 改为 `[guard_sc 分节, { id: "gift_danmaku", types: ["gift", "danmaku"], mode: "mixed" }]`；1 栏不变；`resolveColumns`/断点/`FeedColumn` 零改动；
3. **礼物图标**：`types.ts` gift Zod schema 增 `iconUrl: z.string().optional()`；`GiftItem.tsx` 在「礼物」chip 与礼物名同行前置 `<img src={iconUrl} alt="" loading="lazy" className="h-5 w-5 shrink-0 rounded-sm object-contain">`，`onError` 置 state 隐藏；缺 `iconUrl` 不渲染 `<img>`；图标 `h-5` 小于文字行高，不影响虚拟化行高；
4. **上船特写**：`GuardItem.tsx` 船型 chip 前置 `<img src={guardBadgeAsset(guard.level)} className="h-4 w-4">`（`guardBadgeAsset` 返回 null 的未知等级不渲染）、chip 字号 `text-[10px]` → `text-xs` 保持 `font-semibold`；船型配色沿用 `guardLevelTone`；已读置灰/「New」标记/双击交互不动；
5. 单测覆盖（提案 §8.1）：`danmaku-columns.test.ts` 新 `DEFAULT_COLUMNS`/`COLUMN_PRESETS[2]` 断言（分节/混排与类型顺序）与 `resolveColumns` 适配；`backdoor-sidenav.test.tsx` 文案断言；`danmaku-items.test.tsx` GiftItem 图标有/无/onError 三态、GuardItem 三档徽章与未知等级回退；`danmaku-dashboard.test.tsx` 默认 3 栏断言更新；
6. 视觉约束：仅用 `@theme` token 色、无动画/光效、无未上线功能占位。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；`grep -r "弹幕后台" apps/bookstore` 仅剩历史文档/无用户可见残留。

### 步骤 4：e2e 断言同步（subagent，SKILL: z-test）

加载 `tests/e2e/AGENTS.md`。无新增页面/端点，仅同步既有用例：

1. `tests/e2e/src/backdoor/danmaku.spec.ts`：`:240,260,263,364` 「弹幕后台」导航链接/标题断言更名「弹幕看板」；`:265` 默认三栏注释与断言更新为「礼物 | 上船+SC 分节 | 弹幕」；`:434-450` 「SC+上船 栏默认混排」改为「上船+SC 栏默认分节」（radio 默认选中「分节」），localStorage 断言更新为 `{ id: "guard_sc", types: ["guard_buy", "super_chat"], mode: "split" }`；
2. `unconfigured.spec.ts:35` 导航无入口断言同步更名；
3. `tests/e2e/AGENTS.md:35` 描述口径同步；
4. 回归既有 e2e 全量用例。

**验证**：Aspire 编排下配置/未配置两种形态 e2e 分别全绿。

### 步骤 5：API 集成测试回归

无新增端点、契约向后兼容（仅增可选字段）：`tests/api` 既有 `live-events` 用例保持绿即可，不新增用例。Aspire 编排下 `tests/api` 全量回归（含既有用例）。

**验证**：Aspire 编排下 `tests/api` 全量通过。

### 步骤 6：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`（更名「弹幕看板」、二期默认分栏口径、礼物图标、船型特写现态）与 `docs/engineering/spec/frontend-bookstore.md`（对应模块现态）、`docs/engineering/spec/backend-live.md`（`gift.iconUrl` 字段现态）；
2. 更新 `apps/bookstore/AGENTS.md`（弹幕看板约定段更名与新口径）、`servers/api/AGENTS.md`（normalize gift 字段口径，如有必要）；PRD 与提案为时点文档，不改原文；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；
4. 推送 `feat/danmaku-board-v2` 并提 PR 至 `prd/danmaku-board-v2`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：上游 `SEND_GIFT` payload 携带 `data.img_basic`（需实测样本确认；缺失则字段恒不下发、前端恒走无图标兜底，功能降级不破版）；一期弹幕看板全部既有实现（契约、栏位配置、已读管理、虚拟化）为改造基底；无新增依赖、无编排/基础设施变更；
- **并行协调**：单一开发分支 `feat/danmaku-board-v2`，契约先行（前后端/测试均依赖）；后端与前端 subagent 串行；e2e 断言同步依赖前端就绪；API 测试仅回归；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 上游 `img_basic` 缺失或不稳定——契约字段可选 + 前端无图标兜底，验收按「携带则渲染」口径（步骤 2/3）；
  - 已落盘一期默认 3 栏配置的用户看到旧布局——PRD 口径属个人偏好不迁移；一期上线窗口极短，影响面可忽略（提案 §5.2 实现点 2 已接受）；
  - 图标尺寸影响虚拟化行高——图标 `h-5` 小于文字行高且容器 `shrink-0` 固定尺寸，单测断言行高稳定（步骤 3.3）；
  - 特写过度——仅徽章 + 字级/字重强调，禁动画/光效/大面积高饱和色块（PRD 约束，步骤 3.4）；
  - localStorage key 误更名导致存量配置清空——key `danmaku-backdoor.columns` 保持不变，实现与 review 双重把关（步骤 3.1）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-16-danmaku-board-v2-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-16-danmaku-board-v2-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 一期实现方案：[[2026-08-16-danmaku-backdoor-impl-plan.md]]
- 既有契约：`contract/live-events.openapi.yaml`
