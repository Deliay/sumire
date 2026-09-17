# servers/api

枝堇Sumire 后台系统 V1 后端——Express 5 + TypeScript（strict）纯 API 服务，不托管任何页面。

开发前加载 `docs/engineering/backend-rules.md` 与 API 契约 `contract/backdoor-auth.openapi.yaml`、`contract/stream-plans.openapi.yaml`、`contract/live-history.openapi.yaml`、`contract/live-events.openapi.yaml`、`contract/topics.openapi.yaml`（均为单一事实源）。

## 技术栈

- Node.js + Express 5 + TypeScript（strict），纯 API（仅 `/api/*`，其余 404）
- Session-Cookie + Redis（ioredis），会话 TTL 7 天滑动
- 权限：`requireRole` 角色中间件（superadmin > admin > member）
- MongoDB（Mongoose）持久化 `users`
- bcryptjs 密码哈希
- Vitest 单元测试

## 常用命令

在 `servers/api/` 下执行：

```bash
pnpm dev        # tsx watch 本地开发
pnpm build      # tsc 构建
pnpm test       # Vitest 单元测试
pnpm lint       # tsc --noEmit 类型检查
```

## 目录

| 目录 | 职责 |
|------|------|
| `src/index.ts` | 入口：连接存储、种子、启动 |
| `src/app.ts` | Express 装配（仅 /api + CORS） |
| `src/auth/` | 登录/登出/改密/会话/限速 |
| `src/rbac/` | 角色与权限中间件 |
| `src/session/` | Redis 会话与 Cookie |
| `src/db/` | MongoDB 连接与 users、stream_plans、live_event_reads、topics、marshmallows 模型 |
| `src/liveEvents/` | 直播事件上游客户端（`upstream.ts`）与 B 站 payload 归一化（`normalize.ts`） |
| `src/topics/` | 棉花糖域：visitorCookie、rateLimit、reviewQueue、reviewWorker |
| `src/routes/` | /api/auth/*、/api/users、/api/stream-plans、/api/live-history、/api/live-events、/api/topics、/api/marshmallows |
| `src/infra/` | 直播缓存抽象：历史直播（`LiveHistoryCache`）、直播状态（`LiveStatusCache`）、录播回放事件（`LiveEventsReplayCache`）与各自实现 |
| `tests/` | 单元测试 |

## 关键约定

- 错误响应统一 `{ error: string }`，中文文案；
- 密码强度：≥16 位且含字母、数字、符号（服务端校验为准）；
- 初始超管 `supersumire` 由 `BACKDOOR_USERNAME`/`BACKDOOR_PASSWORD_HASH` 种子（幂等）；
- 改密后 `mustChangePassword=false`；新用户创建后 `true`；
- 登录限速 5 次/分钟/IP（Redis）；
- `/api/stream-plans`：GET 公开读（无需登录，`from`/`to` 显式日期校验后走 `$gte`/`$lte`，拒绝对象注入）；POST/PUT/DELETE 走 `requireRole("admin")`（superadmin/admin 可写，member 403）。字段：`date` 为 `YYYY-MM-DD` 真实日期、`startTime` 为 `HH:mm` 真实时间（`isValidTime`）、`title` trim 后 1–50 字符；判重键 `(date, startTime, title)`（PUT 编辑排除自身 409）；PUT/DELETE `:id` 先校验 ObjectId 形态否则 400、不存在 404，PUT 写 `updatedAt`；`stream_plans` 集合由 mongoose 自动创建；
- `/api/live-history`：GET 公开读代理。上游地址 `config.liveHistoryUpstreamUrl`（读 `LIVE_HISTORY_UPSTREAM_URL`，**未配置时回退 PRD 内网地址 `http://vtuber.internal.fffdan.com/api/b/live/1727076670/history`**，内置缺省值、不得因缺变量抛错）；处理链：读 Redis 缓存（key `live-history:latest`，TTL 300s）→ 未命中 `fetch` 上游（5s 超时，`buildUpstreamUrl` 追加 `page=1&pageSize=100`）→ 解析分页信封 `{ total, page, pageSize, items }` 的 `items`（`extractItems`，兼容裸数组）→ 裁剪为 `title`/`startDate`/`stopDate` 三字段（缺 `title`/`startDate` 丢弃）→ 按 `startDate` 倒序取 100 条 → 写缓存返回 `{ ok: true, records }`；上游失败（超时/网络错误/非法 JSON/既非数组也非信封）→ stale-if-error 重读缓存，仍无则返回 `{ ok: false, records: [] }`（HTTP 200，不用 5xx）；缓存经 `AppDeps.liveHistoryCache` 注入（生产用 Redis 实现，缺省内存实现），上游 fetch 可注入便于单测。
- `/api/live-status`（契约 `contract/live-status.openapi.yaml`，**路径为两段式 `/api/live/status`**，PRD 指定）：GET 公开读代理。上游地址 `config.liveStatusUpstreamUrl`（读 `LIVE_STATUS_UPSTREAM_URL`，未配置回退 PRD 内网地址 `http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current`，内置缺省值、不得因缺变量抛错）；处理链照搬 live-history：读 Redis 缓存（key `live-status:latest`，TTL 30s）→ 未命中 `fetch` 上游（5s 超时，`AbortSignal.timeout(5000)`）→ 防御式归一化（`normalizeLiveStatus`，无 zod 手写类型守卫：`live` 布尔为唯一强保证字段，兼容顶层/嵌套 `live`/`live_status`/`is_live`/`status` 的 boolean 与 0/1 数字语义；`title`/`startedAt` 缺字段时为 `null`）→ 写缓存返回 `{ ok: true, status }`；上游失败（超时/网络错误/非法 JSON/无法确定 live 布尔）→ stale-if-error 重读缓存，仍无则返回 `{ ok: false, status: null }`（HTTP 200，不用 5xx）；缓存经 `AppDeps.liveStatusCache` 注入（生产用 Redis 实现，缺省内存实现），上游 fetch 可注入便于单测。
- `/api/live/:name/status`（契约 `contract/live-status.openapi.yaml`，同期直播状态）：GET 公开读代理。name 白名单枚举（viridis/komichi/chu2u），未知 name 404 `{ error: "未知的同期主播" }`；上游 base URL `config.livePeerStatusUpstreamUrl`（读 `LIVE_PEER_STATUS_UPSTREAM_URL`，缺省 `http://vtuber.internal.fffdan.com`，内置缺省值、不得因缺变量抛错）；内置 name→roomId 映射防 SSRF（viridis→1727071052、komichi→1700301235、chu2u→1727074031）；处理链与 live-status 完全同构，复用 `normalizeLiveStatus`；Redis 缓存键 `live-peer-status:{name}`，TTL 30s（按 name 隔离，与 live-status 共享同一 cache 实例）；上游失败 stale-if-error + 200 降级，永不 5xx。
- `/api/live-events`（契约 `contract/live-events.openapi.yaml`）：检索 `GET /`、搜索 `GET /search` 与 SSE `GET /stream` 走 `requireRole("member")`，三个已读写接口（`POST /read` `/unread` `/read-all`）走 `requireRole("admin")`（member 403）；未登录一律 401。上游 base URL `config.liveEventsUpstreamUrl`（读 `LIVE_EVENTS_UPSTREAM_URL`，缺省回退 `http://vtuber.internal.fffdan.com`，端点路径由 `liveEvents/upstream.ts` 拼接 `/api/b/live/1727076670/event/range|search|subscribe`，不得因缺变量抛错）；上游客户端经 `AppDeps.liveEventsUpstream` 注入（缺省按 config 创建）。归一化集中在 `liveEvents/normalize.ts`（五类 cmd → LiveEvent：danmaku/super_chat/gift/gift_v2/guard_buy，eventId 派生 `dm:{id_str}` / `sc:{id}` / `gift:{batch_combo_id ?? combo_id}`（gift_v2 使用 `gift:{batchComboId}` 或回退 `gift:{uid}:{giftId}:{timestamp}`）/ `guard:{uid}:{start_time}`；danmaku 兼容 dm_v2 缺失回退经典 `info[0][7]`、`extra` 对象/字符串双形态，表情弹幕（`info[0][12]===1`）提取经典 `info[0][13].url` 为 `emote`（含原图 `width`/`height`）；信封 occurredAt 缺失/非法或解析失败返回 null + console.warn 不中断；实测样本夹具在 `tests/fixtures/live-events/`）。已读状态在 `db/liveEventReads.ts`（`live_event_reads` 集合，`eventId` 唯一索引 + `{ type, kind }` 索引）：单条 read/unread 幂等 upsert 互相覆盖；read-all 写 `watermark:{type}` 水位线（`$max` 只前进不后退）；出口统一 `resolveReadState` 合并（单条记录优先于水位线，无单条时 `occurredAt <= readBefore` 即已读）。检索上游失败 → 502 `{ error: "上游事件服务不可用" }`；SSE 按连接透传、`flushHeaders()` 先下 200 + 头、30s `: ping` 心跳、`req.on("close")` 中止上游、断流指数退避重连（1s→30s，心跳/退避参数可经路由 deps 覆盖供单测）；写接口缺参 400 中文错误。路由层 `toUpstreamTypes` 将契约 `gift` 展开为 `["gift", "gift_v2"]`（前端透明），检索与 SSE 两处统一走扩参。搜索端点 `GET /search`：`stringCriteria` 必填（trim 后非空、长度 1–200），`page`/`pageSize` 复用 `parsePageParam`（fallback 20、上限 100），上游 `event/search` 端点路径。录播回放 `GET /replay` 为**公开端点**（不挂 `requireRole`，与 member 端点共存于同一 router，先例 `/api/topics/public`）：`start`/`end` 必填字符串且 `new Date` 合法、`end > start`、区间 ≤12h；`type` 可重复，仅允许四类（含 `online_rank_count` 即 400，缺省四类）；`page` ≥1 默认 1、`pageSize` 1–100 默认 100，非法一律 400 中文 `{ error }`。取数采用**服务端分页扫描兜底**（本环境未实测上游时间参数，**不得**向未知上游透传 start/end 以免报错）：自 page=1/pageSize=100 翻页，上游按 occurredAt 倒序，逐条 `toLiveEvent` 归一化后收集 `occurredAt ∈ [start,end]` 事件，遇 `occurredAt < start` 立即终止（倒序保证其后含后续页全部越界），扫描上限 50 页（≈5000 条）截断并如实返回区间内计数的 total；区间内事件按 occurredAt 升序、按 page/pageSize 切片。出口构造 `ReplayEvent` 投影，手工剔除 `read`、`sender.nameRomaji`、`contentRomaji`（**不调用** `resolveReadState`/`annotateRomaji`，零 Mongo/kuroshiro 开销）。缓存键 `live-events:replay:{startIso}:{endIso}:{types 逗号连接}:{page}:{pageSize}`、TTL 300s，经 `AppDeps.liveEventsReplayCache` 注入（生产 Redis 实现、缺省内存实现），命中直接返回缓存 JSON；上游抛错 → 502 `{ error: "上游事件服务不可用" }`。

提交前 `pnpm lint && pnpm test` 全绿。相关文档：[[../../docs/engineering/backend-rules.md]]
