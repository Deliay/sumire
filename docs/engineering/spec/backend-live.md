# 后端直播域 Spec（servers/api — live-history / live-events / live-status）

对内网直播数据服务（`http://vtuber.internal.fffdan.com`，B 站房间 1727076670，硬编码于 URL 前缀）的代理与归一化层。上游地址收敛在服务端经 env 注入（`LIVE_HISTORY_UPSTREAM_URL` / `LIVE_EVENTS_UPSTREAM_URL` / `LIVE_STATUS_UPSTREAM_URL`），不出现在客户端。

## 上游客户端（liveEvents/upstream.ts）

- 历史：`GET {base}/api/b/live/1727076670/history`。
- 事件检索：`GET {base}/api/b/live/1727076670/event/range`（分页，5s 超时）。
- 事件搜索：`GET {base}/api/b/live/1727076670/event/search`（分页，5s 超时）。
- 事件订阅：`…/event/subscribe`（SSE 逐行解析，仅取 `data:` 行）。

## GET /api/live-history（公开）

- 追加 `page=1&pageSize=100`；兼容分页信封 `{items}` 与裸数组。
- 仅透传 title/startDate/stopDate 三字段；缺 title/startDate 的条目丢弃；按 startDate 倒序取 100 条。
- Redis 缓存键 `live-history:latest`，TTL 300s；**上游失败 stale-if-error 重读缓存，仍无则降级 200 + `{ok:false, records:[]}`，永不 5xx**。
- 缓存抽象 `infra/liveHistoryCache.ts`（Redis 实现 + 内存实现）。

契约：`contract/live-history.openapi.yaml`。

## GET /api/live/status（公开）

- 上游：`GET {LIVE_STATUS_UPSTREAM_URL}`（缺省 `http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current`，房间号服务端内置固定，不暴露参数防 SSRF）；`AbortSignal.timeout(5000)`，`fetchFn` 可注入。
- 防御式归一化（`routes/liveStatus.ts` `normalizeLiveStatus`，无 zod 手写类型守卫）：`live` 布尔为唯一强保证字段（兼容顶层/嵌套 `live`/`live_status`/`is_live`/`liveStatus` 的 boolean 与 `live_status`/`status` 的 0/1 数字语义）；`title`/`startedAt` 防御式可选，上游缺字段时为 `null`。无法确定 `live` 布尔视为上游失败。上游**实测**结构 `{ roomId, title, liveStatus, liveSessionId, createdAt }`：`liveStatus` 布尔 → `live`，`title` 透传，`createdAt` 归入 `startedAt`。
- Redis 缓存键 `live-status:latest`，TTL **30s**；**上游失败 stale-if-error 重读缓存，仍无则降级 200 + `{ok:false, status:null}`，永不 5xx**。
- 缓存抽象 `infra/liveStatusCache.ts`（Redis 实现 + 内存实现）；装配挂载两段式路径 `/api/live/status`（与既有 kebab-case 域根的层次差异按 PRD 实现）。
- 上游真实响应结构经实测后归一化口径回写本文件与契约。

契约：`contract/live-status.openapi.yaml`。

## GET /api/live/:name/status（同期直播状态，公开）

- 白名单映射：`viridis` → `1727071052`、`komichi` → `1700301235`、`chu2u` → `1727074031`（`routes/livePeerStatus.ts` `PEER_ROOMS`，服务端内置防 SSRF）；未知 name 404 `{ error: "未知的同期主播" }`。
- 上游：`GET {LIVE_PEER_STATUS_UPSTREAM_URL}/api/b/live/{roomId}/state/current`（base URL 模式，缺省 `http://vtuber.internal.fffdan.com`，env `LIVE_PEER_STATUS_UPSTREAM_URL`）；`AbortSignal.timeout(5000)`，`fetchFn` 可注入。
- 防御式归一化复用 `normalizeLiveStatus`（零改动）；处理链与 `/api/live/status` 完全同构。
- Redis 缓存键 `live-peer-status:{name}`，TTL **30s**（按 name 隔离，与本人 `live-status:latest` 独立）；**上游失败 stale-if-error 重读缓存，仍无则降级 200 + `{ok:false, status:null}`，永不 5xx**。
- 缓存抽象复用 `infra/liveStatusCache.ts`（与 live-status 共享同一实例，按 key 隔离）；装配挂载 `/api/live` 路由，router 内 `GET /:name/status`。

契约：`contract/live-status.openapi.yaml`。

## LiveEvent 归一化（liveEvents/normalize.ts）

防御式归一化：上游信封 type（danmaku / super_chat / gift / gift_v2 / guard_buy）→ 契约 `LiveEvent`；无法识别返回 null + `console.warn`，绝不抛错中断流。

- eventId 派生：`dm:{id_str}`（dm_v2 extra 优先，回退经典数组 info[0][7]）；`sc:{id}`；`gift:{batch_combo_id ?? combo_id}`（gift_v2 使用 `gift:{batchComboId}` 或回退 `gift:{uid}:{giftId}:{timestamp}`）；`guard:{uid}:{start_time}`。
- 金额：礼物金瓜子 `combo_total_coin/1000`（银瓜子 0），上船 `price/1000`；gift_v2 金瓜子 `comboTotalCoin/1000`（银瓜子 0）。
- 礼物 `data.img_basic` 非空时归一化为可选 `gift.iconUrl`，缺失或空串时不下发；gift_v2 优先 `giftList.giftInfo.imgBasic`，回退 `data.img_basic`。
- 牌子颜色兼容十进制整数 → hex；guard_buy 恒无 face/medal。
- 弹幕表情两来源：经典 `info[0][13]` emoticon 对象 + `extra.emots` 按 content 键控的小表情映射。
- `sender.guardLevel`（3=舰长/2=提督/1=总督）弹幕/SC/礼物均携带，仅身份标识；gift_v2 优先 `data.guardLevel`，回退 `senderUinfo.medal.guardLevel`。
- occurredAt 缺失/非法的事件直接丢弃（不回退当前时间，避免污染水位线比较）。
- gift_v2 归一化为 `type: "gift"`（对前端透明），EVENT_TYPES 包含五类但契约枚举仍为四类。

## 罗马音标注（liveEvents/romaji.ts）

kuroshiro+kuromoji（懒加载字典）→ 失败则 OpenCC 简→日汉字重试 → 兜底 hepburn 仅转假名；进程内 Map 缓存；无假名返回 null。仅 live-events 域使用。无类型包的手写声明在 `types/{hepburn,kuroshiro}.d.ts`。

## 已读模型（db/liveEventReads.ts，Mongo `live_event_reads`）

- 三种 kind：`read` / `unread` 单条记录（eventId 唯一索引，最新覆盖）与 `watermark`（eventId 为 `watermark:{type}`）。
- 判定优先级：**单条记录（含显式 unread）> 水位线**；无单条时 `occurredAt <= readBefore` 即已读。
- 水位线用 `$max` 写入，**只前进不后退**；read-all 取上游首页（≤100 条）的最大 occurredAt 作水位线，`marked` 仅按首页口径统计；该类型无事件时 `marked=0` 不写水位线。
- `resolveReadState` 批量合并：一次查询取单条 + 各类型水位线；分页检索与 SSE 出口统一走它。

## 端点

| 方法+路径 | 鉴权 | 要点 |
|---|---|---|
| GET `/api/live/status` | 公开 | 无参数；防御式归一化；Redis `live-status:latest` TTL 30s；上游失败 stale-if-error + 200 降级 `{ok:false, status:null}`，永不 5xx |
| GET `/api/live/:name/status` | 公开 | name 白名单（viridis/komichi/chu2u），未知 404；防御式归一化复用；Redis `live-peer-status:{name}` TTL 30s（按 name 隔离）；上游 base URL `LIVE_PEER_STATUS_UPSTREAM_URL`；上游失败 stale-if-error + 200 降级，永不 5xx |
| GET `/api/live-events` | member+ | `type` 可重复（五类枚举：danmaku/super_chat/gift/guard_buy/online_rank_count，非法 400）；`page`≥1 默认 1、`pageSize` 1–100 默认 50；`minPrice` 可选（number 0–100，0 或不传不筛选，非法 400）；上游失败 502；items 已归一化 + read 合并 + 罗马音；`type=gift` 向上游请求时展开为 `["gift", "gift_v2"]`；`type=online_rank_count` 透传上游原始信封（不归一化、无 read/罗马音），与其余归一化条目混存 |
| GET `/api/live-events/search` | member+ | `stringCriteria` 必填（string 1–200，trim 后非空）；`page`≥1 默认 1、`pageSize` 1–100 默认 20；上游失败 502；items 已归一化 + read 合并 + 罗马音 |
| GET `/api/live-events/stream` | member+ | SSE，见下；`type=gift` 同样展开为 `["gift", "gift_v2"]` |
| POST `/api/live-events/read` | admin+ | body `{eventId}`；前缀须 dm/sc/gift/guard 否则 400（防摧毁水位线）；幂等 upsert |
| POST `/api/live-events/unread` | admin+ | 同上，写显式 unread 覆盖水位线 |
| POST `/api/live-events/read-all` | admin+ | type 支持 `super_chat`/`guard_buy`/`gift`；`gift` 走 `toUpstreamTypes` 展开为 `["gift", "gift_v2"]`；水位线语义 |

## SSE（/api/live-events/stream）

- 先 `flushHeaders` 下 200（上游无事件时不主动刷头）；30s 一条 `: ping` 注释心跳。
- 上游断流指数退避重连 1s 起步 ×2 至 30s 上限，**收到事件即重置退避**。
- 客户端断开即 AbortController 中止整条链路；每帧 `data: <LiveEvent JSON>\n\n`，同样合并 read + 罗马音。
- `type=online_rank_count` 事件不归一化，以命名帧 `event: online_rank_count\ndata: <上游原始信封 JSON>\n\n` 透传，与其余类型的无名帧可在同一流中混发。

契约：`contract/live-events.openapi.yaml`。

## 存储汇总

- Redis（ioredis 单实例五用）：会话 `session:*`、登录限流 `login:*`、历史直播缓存 `live-history:latest`、直播状态缓存 `live-status:latest`、同期直播状态缓存 `live-peer-status:{name}`（name 白名单枚举）。
- MongoDB：`users`、`streamplans`、`live_event_reads` 三集合。
