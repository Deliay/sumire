---
description: 直播间在线人数展示实现方案 v1.2——基于 PRD v1.1 与技术提案 v1.0，按集成验收真实环境实测打回意见二次修订（在线人数直接解析 SSE 命名帧 payload.online_count、订阅并入看板唯一 SSE 连接、range 首取仅作首屏兜底至多 1 次 GET；沿用 v1.1 口径：不新增独立端点，复用 GET /api/live-events 扩展 type=online_rank_count 透传原始信封、/stream 命名帧透传；TDD 步骤、并行分工、验证与验收）
type: Permanent
---

# 直播间在线人数展示 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-21-online-count-prd.md]]（v1.1）
**关联技术提案**: [[../proposals/2026-08-21-online-count-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/online-count`
**开发分支**: `feat/online-count`（自需求总分支合入 main 后自主线切出，**唯一开发分支**；提案页首口径）
**版本**: v1.2（2026-08-22，按集成验收真实环境实测打回意见二次修订）
**作者**: sumire workflow

> **v1.2 修订说明（集成验收 D1–D3 打回意见落实）**：真实上游环境下 `event/range` 历史检索查不到 `online_rank_count`（实时推送帧），v1.1「SSE 帧仅作触发器、数值仍经 GET 取数」口径不成立（验收打回 D2：在线人数恒不展示）。修订三点：① **直接解析帧取数**——`online_count` 从 `online_rank_count` 命名帧 `payload.online_count` 直接读取（帧即完整信封），事件到达不再触发 GET；5s 节流保留但作用于数值更新（防高频抖动，不产生额外请求）；② **单连接**——`online_rank_count` 订阅并入弹幕看板既有唯一 SSE 连接（`useLiveEventStream` 订阅类型追加 + 命名帧监听解析透出），全页面 `/api/live-events/stream` 仅一条连接，不再单开第二条 EventSource（打回 D1）；③ **首取兜底**——range 首取仅作首屏兜底，刷新页面至多 1 次 GET（打回 D3）。服务端契约与透传行为不变。
>
> **v1.1 修订说明（评审打回意见落实）**：① 取消独立的 `GET /api/live-events/online-count` 端点——首次获取直接复用既有 `GET /api/live-events`（type 白名单扩展 `online_rank_count`，该类型事件透传上游原始信封、不走 LiveEvent 归一化管道），前端从最新一条信封 `payload.online_count` 提取数值；② SSE 通道维持既有口径——复用 `/api/live-events/stream`，仅新增 `online_rank_count` type、命名帧透传。本方案据此取代提案 v1.0 中「新增 online-count 端点」的设计（提案为时点文档不改原文，以本方案为准），其余前端展示与节流口径不变。

本方案将技术提案 v1.0（经评审修订）落实为可执行的实施计划。本期涉及**契约、服务端、前端三层变更**，无数据库与配置变更。前提事实（已在需求总分支核对代码现态）：

- `servers/api/src/liveEvents/upstream.ts:30-35`：`LiveEventsUpstream.fetchRange(types, page, pageSize, minPrice?)` 与 `subscribe(types, onEvent, signal)` 均为通用 `string[]` 类型参数，`type=online_rank_count` 直接可用——**upstream 层零改动**；
- `servers/api/src/routes/liveEvents.ts:8`：`LIVE_EVENT_TYPES` 白名单四类（`danmaku/super_chat/gift/guard_buy`）；`:29-40` `parseTypesParam` 按该白名单校验（`/`、`/search`、`/stream` 三端点共用）；`:43-45` `toUpstreamTypes` 仅做 `gift → [gift, gift_v2]` 展开，其余原样；`:63-66` `upstreamUnavailable`（502 `{ error: "上游事件服务不可用" }`）可复用；
- `routes/liveEvents.ts:100-130`：`GET /` 处理器现为 `parseTypesParam` → `fetchRange` → `normalizeAll`（`:69-71`，`toLiveEvent` 归一化并过滤 null）→ `resolveReadState` → `annotateRomaji`。`online_rank_count` 非 `LiveEvent`，须在归一化处分支透传原始信封、跳过已读/罗马音管道；
- `routes/liveEvents.ts:167-238`：stream 处理器内 `send()`（`:189-198`）对所有信封做 `toLiveEvent` 归一化后写无名帧——`online_rank_count` 须在 `send()` 前置分支以命名帧透传并跳过整条管道；心跳（30s `: ping`）与指数退避重连（1s 起步、30s 上限）逻辑不触及；
- `apps/bookstore/app/backdoor/(dashboard)/danmaku/page.tsx`：普通模式页头 `<h1>弹幕看板</h1>` 在 `:31`（外层 `:30` 为 `<div>`，含副标题 `:32`），全屏模式页头 `<h1>` 在 `:76`——两处标题各尾随 `<OnlineCountText>`，hook 在页面层调用一次下传；
- `apps/bookstore/features/backdoor/api.ts:18-47`：`API_BASE_URL`、`API_CONFIGURED`、`request()`（cookie `credentials: "include"`，支持 `signal`）为既有基础设施，hook 直接复用；
- `apps/bookstore/features/danmaku/useLiveEventStream.ts:40-44`：既有 EventSource 范式（`withCredentials: true`、内建重连）直接扩展复用——**v1.2 口径：`online_rank_count` 并入看板这条唯一 SSE 连接**（订阅类型追加 + `addEventListener("online_rank_count", …)` 命名帧监听，解析信封经独立回调透出给 `useOnlineCount`），全页面 `/api/live-events/stream` 仅一条连接；栏位类型系统仍不混入 `online_rank_count`（由页面装配层追加订阅类型，栏位配置零感知）；
- 契约 `contract/live-events.openapi.yaml`：`/api/live-events` 与 `/api/live-events/stream` 定义在 `:55`/`:108` 一带，`LiveEventType` 枚举在 `:231`——本期在两个端点的 type 枚举扩展 `online_rank_count` 并写明透传口径，**不新增路径**；
- `tests/api/src/live-events.test.ts`：进程内 stub 上游固定端口 9877（`:16-21`，`EVENT_PREFIX = "/api/b/live/1727076670"`），stub 信封形态 `{ roomId, type, occurredAt, liveSessionId, payload }`（`:29-35`）；鉴权矩阵用例 `live-events-401`（`:385`）断言六端点 401——**本期不新增端点，鉴权矩阵零适配**；
- e2e：`tests/e2e/src/backdoor/danmaku.spec.ts:104` 已封装 `stubLiveEvents(page, events)`（`page.route` 拦截 `/api/live-events*`），本期就地扩展支持 `type=online_rank_count` 的 range 响应；
- 前端单测基底：`apps/bookstore/tests/unit/` 已有 `danmaku-stream.test.tsx`（EventSource mock 范式）、`danmaku-api.test.ts`（fetch mock 范式）、`danmaku-page.test.tsx`（页头断言就地扩展）。

整体顺序：**切开发分支 → 契约先行 → 服务端与前端两个 subagent 并行（TDD）→ e2e → 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.1 / 提案 v1.0 + 评审意见 + 验收打回意见） |
|----|-----------------|---------------------------------------|
| 契约 | type 白名单仅四类 | `GET /api/live-events` 与 `/stream` 的 type 枚举增 `online_rank_count`：`/` 对该类型透传原始信封（不归一化、无 read/罗马音）；`/stream` 对该类型以命名帧透传。**不新增端点** |
| 服务端 | type 白名单四类；`/` 全量归一化过滤 | `/` 与 `/stream` 允许附加 `online_rank_count`（`/search` 不变）；`/` 归一化处对该类型信封原样透传混入 items；stream `send()` 前置命名帧分支 |
| 前端展示 | 看板页头无在线人数 | 普通/全屏两处页头标题后尾随小字号「当前直播间在线 {online_count} 人」；`null` 不渲染（无占位、无错误残留） |
| 前端数据 | 无 | **单连接**：`useLiveEventStream` 订阅类型追加 `online_rank_count` 并 `addEventListener("online_rank_count", …)` 解析信封透出（全页面 `/stream` 仅一条连接）；`useOnlineCount` 直接读取命名帧 `payload.online_count` 更新数值（5s 节流作用于数值更新、不产生额外请求）；挂载首取 `GET /api/live-events?type=online_rank_count&page=1&pageSize=1` 仅作首屏兜底（至多 1 次，空则等首帧）；卸载零请求；`API_CONFIGURED === false` 恒 `null` |
| 测试 | 三层测试全绿 | 增量：API 集成（`/` 透传 online_rank_count、混订、503/502 口径改为「200 空 items」与既有 502、stream 命名帧）、前端单测（帧解析/节流/清理、文案组件）、e2e（文案出现/失败隐藏，stub 以命名帧推送数值、不依赖 range 返回该类型）；既有用例零适配 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/online-count`；
- 开发工作全部在**唯一开发分支** `feat/online-count` 上进行（按提案口径：需求总分支合入 main 后自主线切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 确认 `prd/online-count` 合入 main（含 PRD v1.0、提案 v1.0 与本文档），自主线切出 `feat/online-count`。

**验证**：`git status` 干净，位于 `feat/online-count`。

### 步骤 1：契约先行（contract/live-events.openapi.yaml）

加载 `z-coding` SKILL 与契约文件现态。改动两处，**不新增路径**：

1. 修改 `GET /api/live-events`：`type` 参数 items 枚举扩展为 `[danmaku, super_chat, gift, guard_buy, online_rank_count]`；description 增补口径——`online_rank_count` 不是信息流事件，**不做 LiveEvent 归一化**：响应 items 中该类型条目为上游原始信封透传（`{ roomId, type, occurredAt, liveSessionId, payload }`，无 `read`/`nameRomaji` 字段），与其余类型的归一化 LiveEvent 条目可在同一响应中混存；在线人数取数用法为 `type=online_rank_count&page=1&pageSize=1` 取 `items[0].payload.online_count`；上游无该类型数据时 items 为空（200，非错误）；
2. 修改 `GET /api/live-events/stream`：`type` 参数 items 枚举同样扩展；description 增补——`online_rank_count` 事件不归一化，以命名帧 `event: online_rank_count\ndata: <上游原始信封 JSON>\n\n` 透传，与其余类型的无名帧可在同一流中混发；
3. `GET /api/live-events/search` 的 type 口径**不变**（历史检索不承接 `online_rank_count`）。

**验证**：契约按既有 lint 口径校验通过；diff 仅含上述两处。

### 步骤 2：服务端实现（subagent，TDD，契约就绪后即可启动）

加载 `servers/api/AGENTS.md`（如有）与 `docs/engineering/backend-rules.md`。全程 TDD，先写 `tests/api/src/live-events.test.ts` 新增用例再改实现：

1. **测试先行**（stub 上游 9877 端口现成，新增 `online_rank_count` 信封样本 `payload: { online_count: 1521 }` 形态）：
   - `GET /api/live-events?type=online_rank_count&page=1&pageSize=1`：未登录 401（既有鉴权矩阵已覆盖该端点，零适配）；stub 返回含 `online_count` 信封 → 200 且 `items[0]` 为原始信封透传（含 `payload.online_count`，**无** `read`/`nameRomaji` 字段）；stub items 为空 → 200 且 `items: []`；stub 5xx/超时 → 复用既有 502 中文错误；
   - 混订 `type=danmaku&type=online_rank_count` → 归一化 LiveEvent 条目与原始信封条目各自正确；
   - `type` 含其他非法值仍 400；`/search?type=online_rank_count` 口径不变（search 不收 type 参数，无需用例）；
   - `GET /api/live-events/stream?type=online_rank_count`：stub 推送该类型信封 → 客户端收到 `event: online_rank_count` 命名帧且 data 为原始信封（不归一化）；与四类 LiveEvent 混订 → 无名帧与命名帧各自正确；
2. **实现** `servers/api/src/routes/liveEvents.ts`：
   - 新增 `PASSTHROUGH_TYPES = ["online_rank_count"]`（命名以对齐「透传」语义）；`parseTypesParam` 增加可选参数（如 `extraTypes?: readonly string[]`），`/` 与 `/stream` 调用方传入，`/search` 不变；
   - `toUpstreamTypes` 对 `online_rank_count` 原样透传（现状 flatMap 已自然满足，补注释即可）；
   - `/` 处理器归一化分支：`envelope.type === "online_rank_count"` 的信封跳过 `toLiveEvent`/`resolveReadState`/`annotateRomaji`，原样进入响应 items（与其余归一化条目保序混存；注意 `resolveReadState`/`annotateRomaji` 只接收 LiveEvent 数组，实现上先分流再合并或透传条目后置标注，保持简单）；
   - stream `send()` 前置分支：`envelope.type === "online_rank_count"` 时直接 `res.write("event: online_rank_count\ndata: " + JSON.stringify(envelope) + "\n\n")` 并 return；
   - `upstream.ts` **零改动**；
3. 错误口径：后端规范 `{ error }` 中文消息；日志沿用 `console.warn("[liveEvents] …")` 前缀。

**验证**：Aspire 编排下 `tests/api` 全量通过（新增分组 + 既有用例零回归、鉴权矩阵零适配）；`pnpm -C servers/api build`（或既有 typecheck 口径）通过。

### 步骤 3：前端 hook 与展示（subagent，TDD，可与步骤 2 并行）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md`（AGENTS.md 提示：动手前先读 `node_modules/next/dist/docs/` 对应指南）。全程 TDD：

1. **测试先行**：
   - 新增 `apps/bookstore/tests/unit/danmaku-online-count-hook.test.ts`（EventSource mock 范式参照 `danmaku-stream.test.tsx`，fetch mock 参照 `danmaku-api.test.ts`）：挂载首取返回含 `payload.online_count` 信封 → 数值就绪；items 为空 / `online_count` 缺失或非有限数字 / 请求非 200 或网络错 → 保持现状（不展示或保留最后成功值）；收到 `online_rank_count` 命名帧 → **直接解析帧内 `payload.online_count` 更新数值，不产生新的 GET**；5s 节流——间隔内多帧只产生 leading 一次 + trailing 一次数值更新；帧 `payload` 脏数据（缺失/非有限数字）忽略；卸载后不再发请求亦不更新；
   - `useLiveEventStream` 单测就地扩展：订阅类型含 `online_rank_count` 时连接 URL 携带该 type；收到命名帧 `online_rank_count` 时经透出回调交付解析后的信封（无名帧 eventId 去重逻辑不受影响）；全页面仅创建一条 EventSource；
   - 新增 `apps/bookstore/tests/unit/danmaku-online-count-text.test.tsx`：`onlineCount={null}` 渲染为空；`onlineCount={1521}` 渲染文本「当前直播间在线 1521 人」；`0` 正常渲染「当前直播间在线 0 人」；
   - `danmaku-page.test.tsx` 就地扩展：mock hook 有值时普通模式与全屏模式页头均出现文案（两处同一数值）。
2. **扩展** `apps/bookstore/features/danmaku/useLiveEventStream.ts`（**单连接**，v1.2）：
   - 订阅类型支持追加 `online_rank_count`（不入栏位类型系统，由页面装配层追加，见步骤 3.4）；连接 URL 将其并入 `type` 查询参数；
   - 新增 `addEventListener("online_rank_count", …)` 命名帧监听（`onmessage` 只收无名帧，注释写明）：解析帧 data 为上游原始信封，经新增独立回调（如 `onOnlineCount(envelope)`）透出；命名帧不走 `LiveEventSchema` 归一化与 eventId 去重（信封无 eventId）；
3. **实现** `apps/bookstore/features/danmaku/useOnlineCount.ts`（新增，`"use client"`）：
   - 状态 `onlineCount: number | null`；`API_CONFIGURED === false` 时整体不启用恒 `null`；
   - **帧取数**：接收 `useLiveEventStream` 透出的 `online_rank_count` 信封，防御式解析 `payload.online_count`——有限 number → 经 5s 节流更新（leading 立即 + 间隔内多帧合并为一次 trailing，`setTimeout` 尾随，节流作用于数值更新、**不产生任何请求**），否则忽略；
   - **首取兜底**：挂载时一次 `request("/api/live-events?type=online_rank_count&page=1&pageSize=1", { signal })`（刷新页面至多 1 次 GET），`status === 200` 且 `items[0]?.payload?.online_count` 为有限 number → set，否则视为无数据等首帧；非 200 保持现状；响应类型本地内联声明，**不改动** `features/danmaku/types.ts` 的 LiveEvent 模型；
   - 清理：effect cleanup 中 `AbortController` abort 进行中首取 + 清 trailing 定时器（SSE 连接生命周期归 `useLiveEventStream` 管理，本 hook 不持有 EventSource）。
4. **实现** `apps/bookstore/features/danmaku/components/OnlineCountText.tsx`（新增）：`{ onlineCount: number | null }` 入参，`null` 返回 `null`；否则 `<span className="text-sm font-normal text-ink-dim">当前直播间在线 {onlineCount} 人</span>`（token 色禁硬编码；不触发 aria-live 断言式播报）；
5. **装配** `app/backdoor/(dashboard)/danmaku/page.tsx`：页面层 `useLiveEventStream` 订阅类型追加 `online_rank_count` 并传入在线人数透出回调，`useOnlineCount` 消费该回调（页面层调用一次）；普通模式页头 `:30` 容器改 `flex items-baseline gap-2`（或等效基线对齐），`<h1>弹幕看板</h1>` 后尾随 `<OnlineCountText onlineCount={onlineCount} />`，副标题 `<p>` 布局不破坏；全屏模式页头 `:76` `<h1>` 后同样尾随——两处共用同一份 hook 状态，不重复订阅；**全页面 `/api/live-events/stream` 仅一条连接**；
6. 视觉约束：仅 `@theme` token 色；纯展示无交互。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；既有看板/信息流单测零适配通过。

### 步骤 4：e2e（subagent，SKILL: z-test，步骤 2/3 就绪后）

加载 `tests/e2e/AGENTS.md`。在 `tests/e2e/src/backdoor/danmaku.spec.ts` 增量扩展：

- `stubLiveEvents`（`:104`）扩展：`/api/live-events/stream` 拦截分支可控推送 `event: online_rank_count` 命名帧（data 为含 `payload.online_count: 1521` 的上游信封）；`/api/live-events` range 分支对 `type=online_rank_count` 默认返回**空 items**（对齐真实上游口径：历史检索查不到实时推送帧）——**在线人数路径不得依赖 range 返回该类型**；
- 新增用例（命名 `online-count-<slug>: 中文描述`）：登录后进入看板，stub 经命名帧推送在线人数 → 断言页头标题旁出现「当前直播间在线 1521 人」；不推送帧且 range 空 items / 请求失败 → 文案不出现且看板信息流等其余功能正常；断言全页面 `/api/live-events/stream` 仅一条连接、刷新至多 1 次 `type=online_rank_count` 的 GET；
- 既有看板用例全量回归（stub 扩展不得影响未命中 `online_rank_count` 分支的旧用例）。

**验证**：Aspire 编排（`cd infra/aspire && aspire start`，端点经 `aspire describe` 注入）下 `tests/e2e` 全量通过。

### 步骤 5：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/product/spec/danmaku.md`（页头在线人数展示现态：经看板唯一 SSE 连接的 `online_rank_count` 命名帧直接取 `payload.online_count`、5s 节流更新、range 首取仅作首屏兜底至多 1 次、失败隐藏、双页头）与 `docs/engineering/spec/backend-live.md`、`docs/engineering/spec/frontend-bookstore.md`（type 白名单扩展与透传口径、stream 命名帧、`useLiveEventStream` 命名帧透出、`useOnlineCount`/`OnlineCountText` 模块）；提案为时点文档不改原文，PRD 已随 v1.1 修订；
2. 更新 `apps/bookstore/AGENTS.md` 弹幕看板约定段（`features/danmaku/` 新增 `useOnlineCount.ts` 与 `components/OnlineCountText.tsx`、`useLiveEventStream` 命名帧透出口径、页头双处尾随展示、全页面单条 `/stream` 连接）与 `servers/api/AGENTS.md`（如有 live-events 端点口径则补充 type 扩展）；
3. 核对 PRD §1.3 成功标准逐条通过（提案 §10 中「online-count 端点」条目以本方案 v1.2 的复用口径为准）；
4. 推送 `feat/online-count` 并提 PR 至 `prd/online-count`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：上游 `event/subscribe` 推送 `online_rank_count` 命名帧（数值主来源，帧即完整信封含 `payload.online_count`）；`event/range` 仅作首屏兜底（真实上游对实时推送帧可能查不到，空 items 属正常）；既有 `request()`/`EventSource` 鉴权基础设施与 `upstream.ts` 通用实现（零改动复用）；无新增 npm 依赖、无配置/编排变更（`LIVE_EVENTS_UPSTREAM_URL` 沿用）；
- **并行协调**：步骤 2（服务端：契约定稿后只动 `servers/api` 与 `tests/api`）与步骤 3（前端：`apps/bookstore`）文件不相交，契约就绪（步骤 1）后两个 subagent 并行；步骤 4 依赖两者就绪；步骤 5 串行收尾；
- **风险**（对应提案 §5.2 与评审/验收意见）：
  - EventSource `onmessage` 收不到命名帧——`useLiveEventStream` 必须 `addEventListener("online_rank_count", …)`，契约描述、代码注释与单测三处锁定（步骤 3.2）；
  - 双 SSE 连接（验收打回 D1）——`online_rank_count` 必须并入看板既有唯一连接，禁止在 `useOnlineCount` 内自建 EventSource；e2e 断言全页面 `/stream` 仅一条连接（步骤 3.2/3.5、步骤 4）；
  - 「帧触发再 GET」在真实上游失效（验收打回 D2/D3）——数值必须直接取自命名帧 `payload.online_count`，range 首取仅作首屏兜底、刷新至多 1 次 GET；单测/e2e stub 的 range 分支对 `type=online_rank_count` 默认返回空 items，防止测试与真实上游行为漂移（步骤 3.1、步骤 4）；
  - 上游事件高频——5s 节流（leading+trailing）作用于数值更新（不产生额外请求）是 hook 核心职责，单测覆盖间隔内多帧只尾随一次的边界（步骤 3.1）；
  - `online_count` 脏数据（缺失/字符串/非有限）——前端防御式解析视为无数据不展示，不为上游脏数据扩展契约（步骤 3.3，单测锁定）；
  - `/` 归一化分流若漏判会让 `toLiveEvent` 吞掉 `online_rank_count` 信封（返回 null 被过滤）——透传与混订集成用例锁定（步骤 2.1）；stream 命名帧前置分支同理；
  - 响应 items 混存两种形态（归一化 LiveEvent + 原始信封）——前端只在 `type=online_rank_count` 单类型请求下解析，看板信息流不带该类型，回归面为零（既有单测零适配验证）；
  - 双页头各自调 hook 会重复订阅——hook 只在页面层调用一次、数值下传，`danmaku-page.test.tsx` 锁定两处同值（步骤 3.5）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-21-online-count-prd.md]]（v1.1）
- 技术提案：[[../proposals/2026-08-21-online-count-proposal.md]]（v1.0；其中「新增 online-count 端点」设计经评审修订，以本方案 v1.2 为准）
- 契约：`contract/live-events.openapi.yaml`
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]；后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
