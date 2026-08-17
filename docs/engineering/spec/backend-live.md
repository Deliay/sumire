# 后端直播域 Spec（servers/api — live-history / live-events）

对内网直播数据服务（`http://vtuber.internal.fffdan.com`，B 站房间 1727076670，硬编码于 URL 前缀）的代理与归一化层。上游地址收敛在服务端经 env 注入（`LIVE_HISTORY_UPSTREAM_URL` / `LIVE_EVENTS_UPSTREAM_URL`），不出现在客户端。

## 上游客户端（liveEvents/upstream.ts）

- 历史：`GET {base}/api/b/live/1727076670/history`。
- 事件检索：`GET {base}/api/b/live/1727076670/event/range`（分页，5s 超时）。
- 事件订阅：`…/event/subscribe`（SSE 逐行解析，仅取 `data:` 行）。

## GET /api/live-history（公开）

- 追加 `page=1&pageSize=100`；兼容分页信封 `{items}` 与裸数组。
- 仅透传 title/startDate/stopDate 三字段；缺 title/startDate 的条目丢弃；按 startDate 倒序取 100 条。
- Redis 缓存键 `live-history:latest`，TTL 300s；**上游失败 stale-if-error 重读缓存，仍无则降级 200 + `{ok:false, records:[]}`，永不 5xx**。
- 缓存抽象 `infra/liveHistoryCache.ts`（Redis 实现 + 内存实现）。

契约：`contract/live-history.openapi.yaml`。

## LiveEvent 归一化（liveEvents/normalize.ts）

防御式归一化：B 站原始 cmd（DANMU_MSG / SUPER_CHAT_MESSAGE / SEND_GIFT / GUARD_BUY）→ 契约 `LiveEvent`；无法识别返回 null + `console.warn`，绝不抛错中断流。

- eventId 派生：`dm:{id_str}`（dm_v2 extra 优先，回退经典数组 info[0][7]）；`sc:{id}`；`gift:{batch_combo_id ?? combo_id}`；`guard:{uid}:{start_time}`。
- 金额：礼物金瓜子 `combo_total_coin/1000`（银瓜子 0），上船 `price/1000`。
- 礼物 `data.img_basic` 非空时归一化为可选 `gift.iconUrl`，缺失或空串时不下发。
- 牌子颜色兼容十进制整数 → hex；guard_buy 恒无 face/medal。
- 弹幕表情两来源：经典 `info[0][13]` emoticon 对象 + `extra.emots` 按 content 键控的小表情映射。
- `sender.guardLevel`（3=舰长/2=提督/1=总督）弹幕/SC/礼物均携带，仅身份标识。
- occurredAt 缺失/非法的事件直接丢弃（不回退当前时间，避免污染水位线比较）。

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
| GET `/api/live-events` | member+ | `type` 可重复（四类枚举，非法 400）；`page`≥1 默认 1、`pageSize` 1–100 默认 50；上游失败 502；items 已归一化 + read 合并 + 罗马音 |
| GET `/api/live-events/stream` | member+ | SSE，见下 |
| POST `/api/live-events/read` | admin+ | body `{eventId}`；前缀须 dm/sc/gift/guard 否则 400（防摧毁水位线）；幂等 upsert |
| POST `/api/live-events/unread` | admin+ | 同上，写显式 unread 覆盖水位线 |
| POST `/api/live-events/read-all` | admin+ | type 仅 `super_chat`/`guard_buy`；水位线语义 |

## SSE（/api/live-events/stream）

- 先 `flushHeaders` 下 200（上游无事件时不主动刷头）；30s 一条 `: ping` 注释心跳。
- 上游断流指数退避重连 1s 起步 ×2 至 30s 上限，**收到事件即重置退避**。
- 客户端断开即 AbortController 中止整条链路；每帧 `data: <LiveEvent JSON>\n\n`，同样合并 read + 罗马音。

契约：`contract/live-events.openapi.yaml`。

## 存储汇总

- Redis（ioredis 单实例三用）：会话 `session:*`、登录限流 `login:*`、历史直播缓存 `live-history:latest`。
- MongoDB：`users`、`streamplans`、`live_event_reads` 三集合。
