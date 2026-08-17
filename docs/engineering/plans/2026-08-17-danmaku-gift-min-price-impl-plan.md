---
description: 弹幕看板礼物金额筛选实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（单一开发分支 feat/danmaku-gift-min-price：契约 minPrice 先行，后端校验+透传 TDD，前端 GiftFilterControl/giftMinPrice/看板接入 TDD，API 测试新增透传与 400 用例；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 弹幕看板礼物金额筛选 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-17-danmaku-gift-min-price-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-17-danmaku-gift-min-price-proposal.md]]（v1.0）
**关联契约**: `contract/live-events.openapi.yaml`（`GET /api/live-events` 增补可选 `minPrice` 查询参数，向后兼容）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/danmaku-gift-min-price`
**开发分支**: `feat/danmaku-gift-min-price`（自需求总分支切出，**唯一开发分支**，契约与实现同在此分支）
**版本**: v1.0（2026-08-17）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `contract/live-events.openapi.yaml:9-29` `GET /api/live-events` 现仅有 `type`/`page`/`pageSize` 三个查询参数，`minPrice` 为纯增量；
- `servers/api/src/routes/liveEvents.ts:43-48` 既有 `parsePageParam` 为「缺省回退 fallback、非法返回 null 由调用方 400」模式，`minPrice` 校验可同构新增 `parseMinPriceParam`；`:87-113` 检索路由在 `page/pageSize` 校验后接入；`:228` read-all 以 `fetchRange([type], 1, 100)` 三参调用——`fetchRange` 末参可选即零改动；
- `servers/api/src/liveEvents/upstream.ts:41-46` `buildRangeUrl` 现仅拼 `type`/`page`/`pageSize`；`:70-76` `fetchRange` 内部调用之，签名扩展为可选末参即可；
- `apps/bookstore/features/danmaku/api.ts:21-31` `listLiveEvents(types, page, pageSize)` 以 `URLSearchParams` 拼参，增可选 `minPrice` 末参；
- `apps/bookstore/features/danmaku/columns.ts:49-67` `getStorage`/`parseColumns`/`loadColumns` 为「读取 + Zod 校验 + 损坏回退默认」既有口径，`giftMinPrice.ts` 仿此（但无需 useSyncExternalStore 订阅——阈值仅看板单组件持有，提案 §5.2 实现点 2）；
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx`：`:104-105` `generationRef` 检索代际机制；`:109-144` `loadSection`、`:147-178` `loadMoreSection`（均经 `listLiveEvents([type], …)`）；`:181-189` 首屏 effect 按 columns 逐节检索；`:197-221` `handleStreamEvent` prepend 分发；`:321-332` 顶层工具区（连接状态提示所在 flex 容器）为「礼物筛选」按钮落点；
- `apps/bookstore/features/danmaku/types.ts:50` `LiveEvent.price?: number`（礼物=combo_total_coin/1000，元）已存在，SSE 过滤直接读取，无类型变更；
- 测试基底：`servers/api/tests/liveEventsUpstream.test.ts:21-45`（buildRangeUrl URL 断言）、`servers/api/tests/liveEvents.test.ts:239,295,315`（`fetchRange` 调用参数断言）、`apps/bookstore/tests/unit/danmaku-dashboard.test.tsx`（看板接入）、`tests/api/src/live-events.test.ts:157-175`（stub 上游回显查询参数，`:394` 既有 400 用例模式）。

整体顺序：**切开发分支 → 契约增补（首批提交）→ 后端校验与透传（TDD）→ 前端实现（TDD）→ API 测试新增用例 → 收尾验收**。单一开发分支 `feat/danmaku-gift-min-price` 共享，各实现 subagent **串行执行**（前端依赖契约参数形态，API 测试依赖后端就绪）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 契约 | `GET /api/live-events` 仅 `type`/`page`/`pageSize` | 增可选 `minPrice`（number，0–100；0 或不传不筛选；非法 400） |
| 服务端 | 检索路由无金额参数；`buildRangeUrl`/`fetchRange` 不透传 | `parseMinPriceParam` 校验 + `fetchRange` 可选末参透传上游 `event/range` |
| 前端检索 | `listLiveEvents` 三参 | 增可选 `minPrice`，>0 时追加查询参数 |
| 看板 | 无筛选入口；礼物节检索/加载更多/SSE 无金额概念 | 「礼物筛选」按钮+弹层（label/滑动条 0–100 步进 0.1/输入框双向同步）；礼物节检索带阈值；阈值变化重载礼物节（页码重置）；SSE 低价礼物前端丢弃 |
| 持久化 | 无 | localStorage `danmaku-backdoor.gift-min-price`（JSON number），损坏回退 0 |
| 测试 | 三层测试全绿 | 增量：后端 URL/校验单测、前端 clamp/持久化/控件/看板接入单测、API 透传与 400 用例；既有用例零回归 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/danmaku-gift-min-price`；
- 开发工作（契约、前后端实现、测试）全部在**唯一开发分支** `feat/danmaku-gift-min-price` 上进行（自 `prd/danmaku-gift-min-price` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/danmaku-gift-min-price` 切出 `feat/danmaku-gift-min-price`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/danmaku-gift-min-price`。

### 步骤 1：契约增补 `minPrice`（feat 分支首批提交）

按提案 §3.1 修改 `contract/live-events.openapi.yaml` 的 `GET /api/live-events` parameters，在 `pageSize`（`:26-29`）后追加：

```yaml
- name: minPrice
  in: query
  description: 最低礼物价值（元），仅对 gift 类型生效；0 或不传表示不筛选
  schema: { type: number, minimum: 0, maximum: 100 }
```

其余端点、参数、鉴权、响应模型、错误结构零变更。

**验证**：YAML 语法合法；diff 仅一处参数增补，与提案 §3.1 逐字一致。

### 步骤 2：后端校验与透传（subagent，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md` 与契约。全程 TDD：先失败测试再实现。改动面：

1. 单测先行：
   - `tests/liveEventsUpstream.test.ts`（`:21-45` 既有 URL 断言区）：`buildRangeUrl(base, types, page, pageSize, 5)` 追加 `minPrice=5`；不传/`0` 时 URL 与现状逐字一致；
   - `tests/liveEvents.test.ts`：检索路由携带 `?minPrice=5` → `fetchRange` 收到第 4 参 `5`；`?minPrice=abc` / `?minPrice=-1` / `?minPrice=101` → 400（文案并入「分页参数非法」口径）；不带参数回归既有断言；
2. `src/liveEvents/upstream.ts`：`buildRangeUrl(base, types, page, pageSize, minPrice?)`——`minPrice !== undefined && minPrice > 0` 时 `url.searchParams.set("minPrice", String(minPrice))`；`fetchRange` 签名同步扩展可选末参并透传；
3. `src/routes/liveEvents.ts`：新增 `parseMinPriceParam(value)`——`undefined` → `undefined`（不筛选）；`Number(value)` 非有限数字、<0、>100 → `null`（调用方 400，复用 `:95-98` 「分页参数非法」分支）；合法值传入 `fetchRange`。**仅在阈值存在时传第 4 参**（`minPrice === undefined` 时保持三参调用），保证 `liveEvents.test.ts:239,295,315` 既有 `toHaveBeenCalledWith` 三参断言零回归；read-all（`:228`）不改；
4. 无 SSE、已读、配置、编排变更。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿（含既有用例）。

### 步骤 3：前端实现（subagent，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与契约。注意 `apps/bookstore/AGENTS.md` 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南。全程 TDD。改动面（对应提案 §5.2 实现点 2–4）：

1. **`giftMinPrice.ts`（新增）**：仿 `columns.ts:49-67` 口径——`MIN_PRICE_STORAGE_KEY = "danmaku-backdoor.gift-min-price"`；纯函数 `clampMinPrice(v: unknown): number` 独立导出（Zod number 校验 → 夹取 [0,100] → 四舍五入到 0.1 步进，任何非法回退 0）；`loadGiftMinPrice()`（SSR/无存储/损坏恒回退 0，无需 useSyncExternalStore）；`saveGiftMinPrice(v)`（夹取后写 JSON number）；
2. **`api.ts`**：`listLiveEvents(types, page, pageSize, minPrice?)`——`minPrice !== undefined && minPrice > 0` 时 `params.set("minPrice", String(minPrice))`，否则请求与现状逐字同构；
3. **`GiftFilterControl.tsx`（新增）**：「礼物筛选」按钮 + 弹层（绝对定位于按钮下方，`border-vine/50 bg-raised` 沿用既有弹层视觉，参照看板内「配置栏位」面板 token 用法）；弹层内 `<label htmlFor>`「最低礼物价值」+ `<input type="range" min={0} max={100} step={0.1}>` + `<input type="number" min={0} max={100} step={0.1}>`；内部草稿字符串允许输入中间态（如 `1.`），滑动条与输入框展示同步，提交（防抖 300ms，输入框 blur/Enter 立即提交）时 `clampMinPrice` 夹取并回调 `onChange(committed)`；再点按钮或点击弹层外关闭，关闭后阈值保持生效；阈值 > 0 时按钮激活态（如 `border-flower text-ink`）；
4. **`DanmakuDashboard.tsx` 接入**：
   - 持有 `minPrice` state（挂载时 `loadGiftMinPrice()` 初始化）+ `minPriceRef` 同步镜像（供 callback 内读取新鲜值，避免依赖频繁重建）；
   - `loadSection`/`loadMoreSection`：礼物类型请求携带 `minPriceRef.current` 阈值；
   - **阈值变化重载**：`onChange` 提交时 `saveGiftMinPrice` + set state + 仅对礼物分节触发 `loadSection`（页码重置为 1）。**对提案 §5.2 实现点 4 的一处收紧**：不递增全局 `generationRef`（会把在途的非礼物节检索结果一并作废且无人补发，导致非礼物节卡在空数据）；改为礼物请求发出时捕获当时阈值，响应返回后比对 `minPriceRef.current`，不一致则丢弃该次礼物结果（等效代际机制、作用域收窄到 gift），非礼物节在途请求不受影响；
   - `handleStreamEvent`：`event.type === "gift" && (event.price ?? 0) < minPriceRef.current` 直接 return 丢弃（不插入、不进 New 标记逻辑——gift 本就不在 `NEW_MARK_TYPES`）；阈值变化前已展示的低价礼物不追溯移除；
   - 按钮置于顶层工具区（`:321-332` 连接状态提示所在容器），与状态提示同一 flex 行；
5. 单测覆盖（提案 §8.1）：
   - 新增 `danmaku-gift-min-price.test.ts`：`clampMinPrice` 夹取/步进取齐/非法回退 0；`loadGiftMinPrice`/`saveGiftMinPrice` 读写与损坏回退（仿 `danmaku-columns.test.ts` 存储用例口径）；
   - 新增 `danmaku-gift-filter-control.test.tsx`：滑动条↔输入框双向同步、非法输入提交时夹取、防抖 300ms 提交（fake timers）、blur/Enter 立即提交、激活态切换、弹层开关；
   - `danmaku-api.test.ts`：`listLiveEvents` 携带/不携带 minPrice 的 URL 断言；
   - `danmaku-dashboard.test.tsx`：阈值 >0 时礼物节请求携带 minPrice、阈值变化仅礼物节重载且页码重置、非礼物节不重新请求、SSE 低价礼物被丢弃/达标礼物正常 prepend、localStorage 损坏回退 0 首屏不带参数；
6. 视觉约束：仅用 `@theme` token 色（禁硬编码色值）、无动画/光效、无未上线功能占位。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：API 集成测试新增用例（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md`。基于 `tests/api/src/live-events.test.ts` 既有 stub 上游（`:157-175` 回显查询参数）：

1. `?type=gift&minPrice=1` → 200，断言 stub 收到的 `qs.get("minPrice") === "1"`（透传），响应信封一致；
2. `?minPrice=abc` / `?minPrice=-1` / `?minPrice=101` → 400（并入 `:394` 既有 400 用例模式）；
3. 不带 `minPrice` 的既有用例保持绿（断言 stub 未收到该参数）；
4. e2e 无新增（控件交互已由前端单测覆盖）。

**验证**：Aspire 编排下 `tests/api` 全量通过。

### 步骤 5：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`（礼物筛选入口、阈值口径、持久化 key 现态）、`docs/engineering/spec/frontend-bookstore.md`（GiftFilterControl/giftMinPrice/看板接入现态）、`docs/engineering/spec/backend-live.md`（`minPrice` 参数与透传现态）；PRD 与提案为时点文档，不改原文；
2. 检查 `apps/bookstore/AGENTS.md`、`servers/api/AGENTS.md` 相关段落是否需同步新口径；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；
4. 推送 `feat/danmaku-gift-min-price` 并提 PR 至 `prd/danmaku-gift-min-price`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：上游 `event/range` 已原生支持 `minPrice`（需求方提供实测 URL）；弹幕看板一期/二期既有实现（分节检索、代际机制、SSE 分发、localStorage 口径）为改造基底；无新增依赖、无编排/基础设施变更；
- **并行协调**：单一开发分支 `feat/danmaku-gift-min-price`，契约先行（前后端/测试均依赖）；后端 → 前端 → API 测试 subagent 串行；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 上游对 `type` 不含 gift 时携带 `minPrice` 的行为未文档化——前端只对礼物节请求携带，服务端透传不剥离（上游自行解释），API 测试以 gift 类型验证（步骤 2/4）；
  - 阈值修改瞬间在途的旧阈值请求——礼物请求捕获阈值、响应比对丢弃（步骤 3.4 对提案的收紧），非礼物节零影响；
  - 滑动条拖动逐帧触发检索——防抖 300ms 提交（提案决策表已定），单测 fake timers 覆盖（步骤 3.5）；
  - range/number 双控件受控死循环——草稿字符串 + 提交时夹取（提案实现点 3），单测覆盖中间态（步骤 3.5）；
  - `fetchRange` 增第 4 参破坏既有 `toHaveBeenCalledWith` 三参断言——仅在阈值存在时传第 4 参，既有断言零改动（步骤 2.3）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-17-danmaku-gift-min-price-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-17-danmaku-gift-min-price-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 二期实现方案：[[2026-08-17-danmaku-board-v2-impl-plan.md]]
- 既有契约：`contract/live-events.openapi.yaml`
