---
description: 录播回放弹幕支持实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/recordings-replay-danmaku，唯一开发分支 feat/recordings-replay-danmaku。前后端双侧变更：契约先行（live-events 新增公开 replay 端点 + ReplayEvent schema）→ 后端 replay 端点（参数校验/上游时间参数实测透传或分页扫描兜底/升序/字段剔除/Redis 300s 缓存，TDD）→ 前端 replay 客户端与纯函数（窗口切分/轨道分配，TDD）→ 回放页路由与列表入口改造（F1，TDD）→ 回放舞台（浮层弹幕 + 事件列表 + 双全屏，F2/F4，TDD）→ e2e → 手工验证 + spec 同步收尾。后端与前端在契约落地后可并行委托 subagent。
type: Permanent
---

# 录播回放弹幕支持实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-17-recordings-replay-danmaku-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-17-recordings-replay-danmaku-proposal.md]]（v1.0）
**需求总分支**: `prd/recordings-replay-danmaku`（需求总 PR：<https://github.com/Deliay/sumire/pull/139>）
**开发分支**: `feat/recordings-replay-danmaku`（自需求总分支切出，**唯一开发分支**，契约/实现/单测/e2e/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-17）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD（每个功能步骤先补失败用例再实现）。变更面横跨三处：`contract/live-events.openapi.yaml`（契约先行）、`servers/api`（live-events 域新增公开 replay 端点）、`apps/bookstore`（回放页与列表入口改造）；无编排资源变更、无新增环境变量。

> **分支口径说明**：提案头部「自需求总分支合入 main 后切出」与既有迭代口径不一致。上一期（2026-09-15 录播优化一期）实际执行顺序为 feat PR 回合需求总分支（#135）→ 需求总分支合入 main（#134）。本方案沿用既有迭代口径：自 `prd/recordings-replay-danmaku` 切出 feat 分支，完成后 PR 回合需求总分支。

**前提事实**（已在需求总分支 `prd/recordings-replay-danmaku` 核对代码现态，commit 4c394fe）：

- 入口现态：内联播放器展开态在 `apps/bookstore/features/recordings/RecordingsApp.tsx:13`（`openFile: {roomId, file} | null`），单例互斥由 `toggleFile`（`:23-27`）保证；文件名点击 `RoomRecordingsGroup.tsx:105-114`、播放主按钮 `RecordingFileActions.tsx:35-43` 同走 `onToggleFile`；内联挂载点 `RoomRecordingsGroup.tsx:126`（`open && <FlvPlayerPanel …>`）；下载为 `<a download>` 原生链接（`RecordingFileActions.tsx:61-69`），本期不动。
- 播放区现态：`FlvPlayerPanel.tsx`（412 行）props `{roomId, file, onClose}`（`:19-23`）；双全屏状态机已存在——`FullscreenMode = "none"|"native"|"web"`（`:25`）、互斥切换（`:243-263`）、`fullscreenchange` 同步（`:134-141`）、web 全屏滚动锁定（`:154-166`）、`containerRef` 全屏容器（`:315`）；`canSeek`（`:81`）；未缓冲 seek 走 `seekUnbuffered` + 15s 看门狗（`:193-226`）。replay 模块直接复用该组件本体，仅全屏容器作用域需按「web 含事件列表 / native 仅视频+浮层」调整（见步骤 5）。
- player/seek 现态：`player.ts` 导出 `play/destroyPlayer/probeSeekable/isPlaybackSupported/seekToByteOffset/pausePlayer/resumePlayer` 与 `subscribePlayer/getPlayingUrl`（`useSyncExternalStore` 归属判断），模块级 `generation` 代次（`:13`）；`seek.ts` 导出 `seekUnbuffered(args): Promise<boolean>`（`:198`），`SeekUnbufferedArgs` 可注入 `seekToByteOffset` 便于单测（`:179`）。两者本期零改动复用。
- 录播数据通路：`features/recordings/api.ts` `RecordingFile = {name, size, createdAt}`（`:28-32`，时间锚点输入已满足）；`RECORDINGS_CONFIGURED`（`:15`）；`getRoomRecordings(roomId)`（`:113`）；基址分派（`:12`）dev 走同源 `/recordings-proxy` rewrites、生产走 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 直连；请求**不带凭据**、非 200 静默降级 `{ok:false}`。
- 路由先例：`app/(site)/(content)/recordings/page.tsx` 为 20 行 Server 壳（metadata + `RECORDINGS_CONFIGURED` 守卫 + Client 组件）；`useSearchParams` 先例为 `topics/page.tsx:14-23`（Server 壳 + `<Suspense fallback={null}>` 包 Client，注释说明 SSG 不支持动态段故用查询串）。
- 弹幕条目组件现态（`features/danmaku/components/`）：`DanmakuItem {event, count?}`（无已读 props）；`SuperChatItem {event, isNew?, onToggleRead?, highlightKeyword?}`、`GiftItem/GuardItem {event, onToggleRead?}`，`event.read` 仅驱动 `opacity-60` 置灰——不传 `onToggleRead` 即无已读交互。**注意**：`features/danmaku/types.ts` `LiveEvent` zod schema `read` 为必填（`:64`），而 replay 端点不下发 `read`——前端 replay 客户端解析后须补 `read: false` 再喂给条目组件（步骤 3 锁定）。
- 本站 API 客户端约定：`features/backdoor/api.ts` `request()`（`:23-47`）一律 `credentials: "include"`；公开只读请求先例为 `features/recordings/api.ts` 独立基址不带凭据。replay 端点客户端沿用「`NEXT_PUBLIC_API_BASE_URL` 基址 + 不带凭据 fetch」；`features/danmaku/api.ts` 复用 backdoor 基址常量可参照。
- 后端路由现态：`servers/api/src/routes/liveEvents.ts` 工厂 `createLiveEventsRouter(deps)`，鉴权逐路由挂载（`GET /api/live-events` `:103` member；search `:148`；stream `:182`；read 系 admin）——**同 router 可混挂公开端点**，先例 `routes/topics.ts:100` `GET /topics/public` 无鉴权；参数校验手写守卫（`parseTypesParam` `:31-43`、`parsePageParam` `:51-56`），无 zod；错误统一 `{error}` 中文，上游失败 502（`:66-69`）。
- upstream 现态：`liveEvents/upstream.ts` `fetchRange(types, page, pageSize, minPrice?)` **无时间参数**（`:29-35`），`buildRangeUrl`（`:43-49`）仅拼 type/page/pageSize/minPrice；`UpstreamPage {total,page,pageSize,items}`（`:20-25`）；超时 5s（`:9`）；`createLiveEventsUpstream(baseUrl, fetchFn?)` 可注入 fetch（`:77`）。上游 `event/range` 是否支持时间参数未知，**实现期实测**，不支持则路由层分页扫描兜底（提案 §3 双路径）。
- 归一化现态：`normalize.ts` `toLiveEvent(envelope): LiveEvent | null`（`:352-382`），`nameRomaji` 恒 null、`read` 恒 false 由出口层填充；已读合并 `resolveReadState`（`db/liveEventReads.ts:114-135`）与罗马音标注 `annotateRomaji`（`routes/liveEvents.ts:77-93`）均在**路由层出口**调用——replay 端点不调用这两者即天然剔除后台语义，零 Mongo/kuroshiro 开销。
- 缓存范式：`infra/liveHistoryCache.ts` `interface { get(key); set(key, value, ttlSeconds) }`（`:4-7`）+ `createMemoryLiveHistoryCache()` 兜底（`:27-37`）；键/TTL 由调用方定义（live-history 300s 先例）；经 `AppDeps` 注入，生产共享 `src/index.ts:23` ioredis 单实例。replay 缓存照此范式新增 `liveEventsReplayCache` 注入。
- 契约现态：`contract/live-events.openapi.yaml` 6 条 paths；`LiveEvent` schema（`:267-350`）required `[eventId, type, occurredAt, sender, read]`；分页信封内联 required `[total, page, pageSize, items]`；**无 securityScheme**，鉴权以 description 文字 + 401/403 responses 引用表达——replay 公开端点沿用该风格（description 注明「公开，无需登录」，不引 401/403）。
- 测试设施：`tests/api` 为黑盒（真实 API + 进程内 `node:http` 上游 stub，`live-events.test.ts:203-280` 固定端口 9877，`LIVE_EVENTS_UPSTREAM_URL` 注入，经 aspire 编排）；公开端点测试先例 `topics.test.ts:133`（不带 CookieJar）；前端单测 jsdom 用 `// @vitest-environment jsdom` 头注释；e2e `tests/e2e/src/bookstore/recordings.spec.ts:42` 浏览器侧 `page.route("**/api/b/live/**")` mock——回放页还需叠加 mock 本站 API 通路（`**/api/live-events/replay*`）。
- Spec 同步位置：`docs/product/spec/site-pages.md` 录播页节；`docs/engineering/spec/frontend-bookstore.md` 录播节；`docs/engineering/spec/backend-live.md`；`apps/bookstore/AGENTS.md` 录播页约定节（`:80-87`，「无契约/后端变更」等口径本期失效需改写）；根 `AGENTS.md` 契约清单已含 live-events，无变更。

整体顺序（契约先行，其后**后端（步骤 2）与前端（步骤 3-5）可并行委托 subagent**，最后汇合 e2e 与收尾）：
**切开发分支 → 契约更新 → [后端 replay 端点（TDD）‖ 前端 replay 客户端与纯函数（TDD）→ 回放页路由与入口改造（TDD）→ 回放舞台（TDD）] → e2e → 手工验证 + spec 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 播放入口 | 文件名/「播放」点击在文件项下方内联展开 `FlvPlayerPanel`（`RoomRecordingsGroup.tsx:126`） | 改为 `<a target="_blank" rel="noopener noreferrer">` 打开 `/recordings/replay?roomId=…&file=…`；内联手风琴与单例互斥逻辑整体退场 |
| 回放页 | 不存在 | 新增 `/recordings/replay`（Server 壳 + Suspense + `useSearchParams`）：左 16:9 视频 + 右侧事件列表 + 视频漂浮弹幕；参数非法/文件不存在/未配置三种空态 |
| 浮层弹幕 | 无 | canvas 2D + rAF 浮层（轨道分配纯函数、50 条同屏上限、emote 图片渲染、暂停悬停/seek 重建） |
| 事件列表 | 弹幕看板为后台登录态（含已读语义） | 回放页公开事件列表：复用 `features/danmaku/components/` 条目（不传 `onToggleRead`、补 `read:false`），随播放进度自动跟随/高亮/点击跳转 |
| 事件取数 | `/api/live-events` 全端点需登录、含 read/罗马音 | 新增公开 `GET /api/live-events/replay`：start/end 区间（≤12h）、升序、剔除 read/罗马音、Redis 300s 缓存；上游时间参数实测透传或分页扫描兜底 |
| 全屏 | 播放区内双全屏状态机（web 仅播放区铺满） | web 全屏上移至舞台容器（视频+浮层+事件列表）；native 仍仅视频+浮层容器；互斥/ESC/能力检测口径不变 |
| 测试 | 录播/弹幕单测与 e2e 覆盖现态内联展开行为 | 新增 replay 端点 API 测试、前端纯函数/组件用例、回放页 e2e；内联展开相关旧断言改写为跳转链接断言（预期内变更面） |
| 文档 | spec 记录内联播放现态；`apps/bookstore/AGENTS.md` 称录播「无契约/后端变更」 | 同 PR 同步 `site-pages.md`、`frontend-bookstore.md`、`backend-live.md`、`apps/bookstore/AGENTS.md` |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/recordings-replay-danmaku`；
- 开发工作在**唯一开发分支** `feat/recordings-replay-danmaku` 上进行（自 `prd/recordings-replay-danmaku` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步；
- 步骤 2（后端）与步骤 3-5（前端）在步骤 1 契约落地后无相互依赖，按 z-coding 流程以 subagent 按子项目并行委托（`servers/api` 一个、`apps/bookstore` 一个），各自小步提交到同一 feat 分支；
- 开发前加载对应目录 AGENTS.md 与规范：后端 `servers/api/AGENTS.md` + `docs/engineering/backend-rules.md`；前端 `apps/bookstore/AGENTS.md` + `docs/engineering/frontend-rules.md`。要点：后端仅 `/api/*`、错误 `{error}` 中文、手写参数守卫；前端全 SSG、`app/` 只做路由组装、样式只用 `@theme` token 色、提交前 `pnpm lint && pnpm test`（前端加 `pnpm build`）全绿。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/recordings-replay-danmaku` 切出 `feat/recordings-replay-danmaku` 并推送。

**验证**：`git branch --show-current` 为 `feat/recordings-replay-danmaku`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：契约更新（contract 先行）

`contract/live-events.openapi.yaml` 新增（风格沿用既有：无 securityScheme，description 文字注明公开性）：

1. path `GET /api/live-events/replay`：description 注明「公开端点，无需登录；面向录播回放场景」；query 参数 `start`/`end`（string date-time 必填，end > start，区间 ≤ 12h）、`type`（可重复，enum `[danmaku, super_chat, gift, guard_buy]`，**不含** online_rank_count，缺省全部）、`page`（≥1 默认 1）、`pageSize`（1–100 默认 100）；
2. 200 响应：分页信封（required `[total, page, pageSize, items]`），items 为新 schema `ReplayEvent`；description 注明 items 按 `occurredAt` 升序；
3. `ReplayEvent` schema：**显式书写不复用 `LiveEvent` 引用**——required `[eventId, type, occurredAt, sender]`；sender required `[uid, name, face, medal]`（**无** `nameRomaji`）；可选字段同 LiveEvent 但**剔除** `read` 与 `contentRomaji`；type enum 限四类；
4. 400（参数非法各分支）与 502（上游不可用）responses，沿用既有 `components.responses` 风格。

**验证**：YAML 解析无误；与 PRD F3/提案 §3 逐条核对（参数、上限、升序、字段剔除、公开性）；契约 diff 仅新增不改动既有端点。

### 步骤 2：后端 replay 端点（TDD）

测试先行（红），两层：

- `tests/api/src/live-events-replay.test.ts`（黑盒，沿用 `live-events.test.ts:203-280` 上游 stub 范式，stub 增加时间区间夹具数据）：
  1. 匿名 200：不带 CookieJar 调用，items 按 `occurredAt` 升序且全部落在 `[start, end]` 内；
  2. 字段裁剪：条目无 `read`/`nameRomaji`/`contentRomaji`，其余归一化字段（eventId/sender/content/emote/price/scColors/gift/guard）与既有口径一致；
  3. `type` 过滤与 gift 展开（`["gift","gift_v2"]`）；缺省四类全部；
  4. 分页：page/pageSize 翻页口径；
  5. 400 全分支：缺 start/end、格式错误、`end ≤ start`、区间 > 12h、type 非法（含 online_rank_count）、page/pageSize 非法；
  6. 502：stub 关闭/超时/返回非法 payload；
  7. 缓存：同参数二次请求 stub 命中计数不增（TTL 300s）。
- `servers/api` 进程内单测（注入 `fetchFn` 与 memory cache，沿用既有单测范式）：上游时间参数透传路径与分页扫描兜底路径（倒序翻页、遇 `occurredAt < start` 终止、扫描页数上限 50 截断）各自覆盖。

实现（绿）：

1. `liveEvents/upstream.ts`：`fetchRange` 增加可选 `{ start?, end? }` 透传参数——**实现期先实测上游 `event/range` 是否接受时间查询参数**（本地起 stub 之外用真实上游 curl 验证，结论回写 `backend-live.md`）；`buildRangeUrl` 支持时拼入，不支持则保持现状由路由层兜底；
2. `routes/liveEvents.ts` 新增 `GET /replay` 路由（**不挂 `requireRole`**，公开先例 `topics.ts:100`）：手写守卫校验（沿用 `parseTypesParam`/`parsePageParam` 风格，新写 `parseTimeRangeParam`：ISO 解析 + `end > start` + ≤12h）→ Redis 缓存查询（键 `live-events:replay:{start}:{end}:{types}:{page}:{pageSize}`，TTL 300s，照 `liveHistoryCache` 范式新增 `liveEventsReplayCache` 经 `AppDeps` 注入，memory 兜底）→ 上游拉取（透传或分页扫描兜底，扫描上限 50 页截断并如实反映 total）→ `toLiveEvent` 归一化（复用，**不调用** `resolveReadState`/`annotateRomaji`）→ 手工剔除 `read`/罗马音字段 → 区间内 `occurredAt` 升序 → 分页返回；
3. `src/index.ts` 接线 Redis 实现。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿；`cd tests/api && pnpm test src/live-events-replay.test.ts` 全绿（aspire 编排 + stub 环境下）；既有 live-events 用例零回归。

### 步骤 3：前端 replay 客户端与纯函数（TDD）

单测先行（红），node 环境：

1. `tests/unit/replay-events.test.ts`：`fetchReplayEvents({start, end, types?, page?, pageSize?})`——URL 拼装（type 可重复、分页参数）、基址取 `NEXT_PUBLIC_API_BASE_URL` 口径、**不带凭据**、非 200/异常静默降级 `{ok:false}`（沿用 `recordings/api.ts` 风格）；**解析后为每条事件补 `read: false`** 以复用 `features/danmaku/types.ts` zod schema 与条目组件；
2. `tests/unit/replay-windows.test.ts`：窗口切分纯函数——`windowIndex = floor(offsetMs / 600_000)`、窗口 start/end 计算（末窗钳制 `recordEnd`）、`offsetMs = Date.parse(occurredAt) - Date.parse(recordStart)` 映射、duration 未知时以 `recordStart + 12h` 为上界；
3. `tests/unit/danmaku-overlay.test.ts`：`assignLane(activeDanmakus, textWidth, videoWidth, speed)` 纯函数——不重叠轨道选择、全轨道占用 + 超 50 条上限丢弃最早批次、字号随宽度缩放（基准 25px@1920）、恒定速度计算。

实现（绿）：

1. `features/recordings/replay/replayEvents.ts`：按契约拼参的公开客户端（不引入 backdoor `request()`，避免凭据语义）；
2. `features/recordings/replay/replayWindows.ts`：窗口切分/偏移映射纯函数；
3. `features/recordings/replay/danmakuOverlay.ts`：轨道分配纯函数 + canvas 渲染器（rAF 驱动、`{text|emote, lane, x}` 在飞弹幕匀速左移、出画回收、暂停挂起、seek 清空重建、emote `Image` 预载缓存未载完以 alt 文本占位、`ResizeObserver` 同步 canvas 尺寸）；渲染器 DOM/canvas 交互部分不进 node 单测，以组件单测覆盖挂载行为。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/replay-events.test.ts tests/unit/replay-windows.test.ts tests/unit/danmaku-overlay.test.ts` 全绿。

### 步骤 4：回放页路由与列表入口改造（TDD，F1）

单测先行（红）：

1. 新增 `tests/unit/replay-page.test.tsx`（jsdom）：参数缺 `roomId`/`file` → 「参数无效」空态 + 返回录播页链接且不发请求；文件列表中查不到 → 「录播不存在或已删除」空态；`RECORDINGS_CONFIGURED=false` → 「服务未配置」空态（与现态口径一致）；正常参数 → 回源 `getRoomRecordings` 匹配 `file` 取 `createdAt`/`size` 并渲染舞台；
2. 改写 `tests/unit/recording-file-actions.test.tsx` 与 `tests/unit/recordings-groups.test.tsx`：「播放」主按钮与文件名渲染为 `<a href="/recordings/replay?roomId=…&file=…" target="_blank" rel="noopener noreferrer">`；列表内**不再**出现内联播放器挂载点；「下载」下拉行为不变（既有断言保留）。

实现（绿）：

1. `app/(site)/(content)/recordings/replay/page.tsx`：Server 壳（`metadata`「录播回放」+ `RECORDINGS_CONFIGURED` 守卫），`<Suspense fallback={null}>` 包 Client `ReplayApp`（沿用 `topics/page.tsx:14-23` 先例）；
2. `features/recordings/replay/ReplayApp.tsx`：`useSearchParams` 解析校验 → `getRoomRecordings(roomId)` 回源匹配 `file`（不信任 URL 透传元信息）→ 三种空态 + 舞台装配（页面结构：标题 + 场次信息 → 舞台 → 操作区「下载该场录播 / 返回录播列表」）；
3. `RoomRecordingsGroup.tsx` / `RecordingFileActions.tsx` 入口改造：移除 `openFile`/`onToggleFile`/`onClosePlayer` 通路与 `FlvPlayerPanel` 内联挂载点（`RecordingsApp.tsx` 的 `openFile` state 与 `toggleFile` 一并退场），改为链接渲染；`FlvPlayerPanel.tsx` 本体迁移至 `features/recordings/replay/` 复用（import 路径同步，组件逻辑本步骤零改动）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/replay-page.test.tsx tests/unit/recording-file-actions.test.tsx tests/unit/recordings-groups.test.tsx` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore build` 通过（SSG 导出含新路由）。

### 步骤 5：回放舞台：浮层弹幕 + 事件列表 + 双全屏（TDD，F2/F4）

单测先行（红，jsdom，mock `@/features/recordings/player`、`seek`、`replayEvents` 与 Fullscreen API）：

1. `tests/unit/replay-stage.test.tsx`：视频区复用 `FlvPlayerPanel` 能力（播放/暂停/音量/进度条/降级提示零回归）；web 全屏作用于**舞台容器**（视频+浮层+事件列表 `fixed inset-0 z-50` + body 滚动锁定 + ESC 退出）；native 全屏作用于**视频+浮层容器**（事件列表不进入）；互斥切换；`fullscreenEnabled=false` 隐藏「全屏」入口；iOS 无 MSE 降级态不渲染全屏入口、事件列表仍展示；
2. `tests/unit/event-timeline.test.tsx`：四类事件条目升序渲染（复用 danmaku 条目组件，无已读操作、无置灰）；`currentTime` 驱动自动滚动 + 当前事件 `--color-flower` 高亮；手动滚动（wheel/touch）暂停跟随 + 「回到当前进度」按钮恢复；点击条目调用舞台 `seekTo(offsetSeconds)`（走既有 `seekUnbuffered` 路径）；加载失败错误态 + 重试；无事件空态文案；
3. `tests/unit/use-replay-events.test.ts`：`ensureWindow` 未命中取数（翻页取尽、页数上限 20）、Map 缓存命中跳过、播放进入后半窗预取下一窗、seek 落点窗与相邻窗优先、代次 last-wins（快速连续 seek 仅最后落点生效）、卸载中止在途请求；
4. 浮层调度：播放前进时 `offset ∈ (prevT, t]` 的 danmaku 入队发射；暂停悬停；seek 清空重建；SC/礼物/上船**不**进浮层；`pointer-events: none` 不遮挡控制条。

实现（绿）：

1. `features/recordings/replay/ReplayStage.tsx`：装配视频区（复用迁移后的 `FlvPlayerPanel`）+ `DanmakuOverlay` canvas 层 + 双全屏状态机（复用既有模式，web 容器上移至舞台级）；
2. `features/recordings/replay/EventTimeline.tsx`：条目复用 + 跟随/高亮/点击跳转；
3. `features/recordings/replay/useReplayEvents.ts`：窗口加载调度 + Map 缓存 + 代次治理（沿用 `player.ts:13` generation 模式）；
4. 视觉：深色卡片流、浮层白色描边文字匀速右→左、焦点环 `--color-flower`，全部 token 色（`night/raised/soft/ink/flower`），动效尊重 reduced-motion；桌面左右并排（视频约 2/3）、移动端上下堆叠，断点遵循 `docs/design/02-page-design.md`。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 6：e2e（tests/e2e/src/bookstore/recordings-replay.spec.ts）

加载 SKILL: z-test。新增 spec（真实媒体播放与 canvas 动画不断言，沿用既有口径）：

1. 沿用 `recordings.spec.ts:42` `page.route("**/api/b/live/**")` mock 录播通路，叠加 `page.route("**/api/live-events/replay*")` mock 本站事件 API（注意 bookstore 对该端点为绝对基址直连，拦截规则匹配全域名）；
2. 列表「播放」/文件名为 `target="_blank"` 链接且 href 指向 `/recordings/replay?roomId=…&file=…`；既有列表 e2e（分组折叠/分页/听直播/下载）零回归；
3. 回放页三要素渲染（视频容器、事件列表、canvas 浮层存在）；事件条目升序展示；点击事件条目触发 seek（断言播放器侧行为或 URL/状态变化的可观察口径）；
4. 网页全屏：舞台容器类名断言 + body 滚动锁定 + 退出还原；
5. 事件 API 失败：事件区错误态 + 重试，视频区不受影响；参数非法空态。

**验证**：`cd tests/e2e && pnpm playwright test src/bookstore/recordings-replay.spec.ts src/bookstore/recordings.spec.ts` 通过。

### 步骤 7：手工验证、spec 同步与收尾验收

1. **手工验证（真实上游，本地 Aspire 编排）**：上游 `event/range` 时间参数实测结论确认并回写；弹幕与播放同步观感（发射/暂停悬停/seek 重建）；窗口加载节奏与缓存命中；高密度时段轨道丢弃策略；网页全屏/全屏切换；iOS Safari 降级（无 MSE 时事件列表可用）；
2. `docs/product/spec/site-pages.md` 录播页节：内联播放退场改为回放页入口；新增回放页行为描述（布局/浮层/列表跟随/双全屏/降级/空态）；
3. `docs/engineering/spec/frontend-bookstore.md` 录播节：replay 模块结构、窗口加载与浮层渲染机制、入口链接化口径；
4. `docs/engineering/spec/backend-live.md`：replay 端点口径（公开、参数上限、升序、字段剔除、缓存键与 TTL、上游时间参数实测结论）；
5. `apps/bookstore/AGENTS.md` 录播页约定节（`:80-87`）：「无契约/后端变更」口径改写为「回放事件经 servers/api 公开 replay 端点」；根 `AGENTS.md` 无变更；
6. 核对 PRD §1.3 成功标准、§3.2 F1-F4 验收标准与提案 §10 全量通过；
7. 推送 `feat/recordings-replay-danmaku`，提 PR 回合 `prd/recordings-replay-danmaku`（需求总 PR #139 随之更新）。

**验证**：workspace 级 `pnpm lint && pnpm test` 全绿 + `pnpm -C apps/bookstore build` 通过；`tests/api` replay 用例与 e2e 录播回放 spec 通过；手工验证清单逐项过；PRD/提案验收清单逐项勾选。

## 4. 依赖与风险

- **依赖**：录播列表 API 持续返回 `createdAt`/`size`（现态已满足）；上游 `event/range` 事件含 `occurredAt`（现态归一化已依赖）；Redis 复用既有实例（无新基础设施）；`NEXT_PUBLIC_API_BASE_URL` 已注入 bookstore（backdoor/danmaku 模块已用）；
- **风险**：上游时间参数能力未知——步骤 2 实现期实测，双路径（透传/分页扫描兜底 50 页上限）均已定义，前端窗口化把单次区间压在 10min 内，实际扫描量小；实测结论回写 spec；
- **风险**：**前端 `LiveEvent` zod schema `read` 必填与 replay 端点剔除 `read` 的矛盾**——步骤 3 锁定客户端补 `read: false` 方案，不改动既有 schema 与条目组件；
- **风险**：时间锚点秒级漂移（`createdAt` ≈ 录制开始）——PRD 认可可接受形态，不做跨文件精校准；
- **风险**：高密度弹幕潮轨道全满——丢弃最早批次策略已定义（步骤 3 纯函数用例锁定）；
- **风险**：现态单测/e2e 大量断言内联展开行为——步骤 4/6 同步改写为链接断言，属预期内变更面，评审时 diff 中应可见；
- **风险**：canvas 尺寸在双全屏切换时变化——`ResizeObserver` 同步重建坐标系（步骤 5）；
- **范围纪律**：不改 `live-history` 契约；弹幕发送、浮层设置项、SC/礼物浮层特效、事件搜索筛选、online_rank_count 均不做（PRD §六）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-17-recordings-replay-danmaku-prd.md]]
- 技术提案：[[../proposals/2026-09-17-recordings-replay-danmaku-proposal.md]]
- 上一期实现方案（录播优化一期）：[[2026-09-15-recordings-seek-fullscreen-impl-plan.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`、`../spec/backend-live.md`
- 直播事件契约：`contract/live-events.openapi.yaml`
- 开发规范：[[../frontend-rules.md]]、[[../backend-rules.md]]
- 页面设计：`../../design/02-page-design.md`
