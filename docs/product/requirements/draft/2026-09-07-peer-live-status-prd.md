---
description: 同期直播状态 API PRD——新增公开端点 GET /api/live/{name}/status（viridis/komichi/chu2u），服务端代理内网上游 state/current 并归一化，无需鉴权，响应口径与既有 /api/live/status 一致
type: Fleeting
---

# 同期直播状态 API

**功能名称**: 同期直播状态 API（Peer Live Status）
**PRD 版本**: v1.0
**创建日期**: 2026-09-07
**作者**: sumire workflow

## 一、背景与目标

### 1.1 背景

站内已有枝堇本人的直播状态端点 `GET /api/live/status`（公开，服务端代理内网上游 `state/current` 并归一化，现态以 `docs/engineering/spec/backend-live.md` 与契约 `contract/live-status.openapi.yaml` 为准）。除枝堇本人外，站点还需要感知三位**同期主播**的直播状态（用于后续在公开页展示同期开播情况）。

上游内网直播数据服务按房间号提供直播状态查询：

```
GET http://vtuber.internal.fffdan.com/api/b/live/{roomId}/state/current
```

同期主播标识与房间号对应关系（服务端内置，不暴露给客户端）：

| name | roomId |
|------|--------|
| viridis | 1727071052 |
| komichi | 1700301235 |
| chu2u | 1727074031 |

### 1.2 目标

- 新增公开端点 `GET /api/live/{name}/status`，按 `name` 查询对应同期主播的当前直播状态；
- 服务端代理内网上游并做归一化与短 TTL 缓存，上游地址与房间号不出现在客户端可见位置；
- 响应口径与既有 `/api/live/status` 一致（`{ ok, status }`，`live` 布尔强保证，上游失败静默降级）。

### 1.3 成功标准

- [ ] `GET /api/live/viridis/status`、`/api/live/komichi/status`、`/api/live/chu2u/status` 均无需登录即可访问，返回 `{ ok: true, status: { live, title, startedAt } }`（上游正常时）；
- [ ] 上游不可达 / 超时 / 返回结构非法时降级为 200 + `{ ok: false, status: null }`，不产生 5xx；
- [ ] 未知 `name`（不在内置白名单）返回 404，不向上游发起请求；
- [ ] 上游地址与房间号不出现在响应体与客户端可见位置；客户端无法经该端点访问任意房间或任意内网地址；
- [ ] 既有 `/api/live/status` 零回归。

## 二、用户分析

### 2.1 目标用户

- 站点访客（未登录）：后续在公开页查看同期主播开播情况的最终受众；
- 前端应用：本端点的直接调用方。

### 2.2 用户场景

| 场景 | 用户角色 | 目标 | 痛点（现况） |
|------|----------|------|------|
| 查看同期开播情况 | 访客 | 知道同期主播谁在直播 | 站内无同期直播状态数据，只能逐个打开 B 站直播间 |
| 前端取数 | 前端应用 | 以稳定归一化结构获取同期直播状态 | 内网上游仅服务端可达，且上游结构不保证稳定 |

## 三、功能需求

### 3.1 功能概述

本期在 live-status 域新增公开端点 `GET /api/live/{name}/status`：`name` 为同期主播标识（白名单 `viridis` / `komichi` / `chu2u`），服务端按内置 name→roomId 映射代理上游 `GET {上游base}/api/b/live/{roomId}/state/current`，沿用既有 live-status 的防御式归一化、30s 短 TTL 缓存与 stale-if-error 降级口径。纯后端 API 与契约变更，无数据库变更，本期不含前端展示。

### 3.2 功能列表

#### F1 同期直播状态查询

**描述**: 新增 `GET /api/live/{name}/status`（公开，无需登录）：

- `name` 路径参数仅接受内置白名单：`viridis`（房间 1727071052）、`komichi`（房间 1700301235）、`chu2u`（房间 1727074031）；不在白名单内的 `name` 返回 404，且不向上游发起任何请求；
- 服务端按映射的房间号代理上游 `state/current`，归一化为与既有 `/api/live/status` 相同的 `LiveStatus` 结构：`live`（boolean，唯一强保证字段）、`title`（string，上游缺字段时为 null）、`startedAt`（ISO 时间戳，上游缺字段时为 null）；
- 响应体与既有端点同构：成功 `{ ok: true, status }`；上游失败 `{ ok: false, status: null }`（HTTP 200，不用 5xx）；
- 响应中不包含房间号、上游地址等内网信息。

**验收标准**:

- [ ] 三个白名单 name 均返回 200 与归一化状态结构；未登录（无 Cookie）访问同样 200；
- [ ] `live` 字段恒为布尔；上游缺 `title`/`startedAt` 对应字段时该字段为 null，不影响 `live`；
- [ ] 未知 name（如 `/api/live/unknown/status`）返回 404 中文错误体 `{ error }`，上游零调用；
- [ ] 响应体任何字段均不泄露 roomId 与上游 URL。

#### F2 缓存与降级

**描述**: 沿用既有 live-status 的缓存与降级口径，按 name 隔离：

- 每个 name 独立缓存键（`live-peer-status:{name}`），TTL 30s；命中缓存时不请求上游；
- 上游不可达 / 超时（5s）/ 非 2xx / 返回结构无法归一化时：stale-if-error 重读缓存，仍无则返回 200 + `{ ok: false, status: null }`，永不 5xx；
- 三个 name 的缓存与降级互不影响（某一房间上游异常不波及其他 name）。

**验收标准**:

- [ ] 30s 内对同一 name 的重复请求至多 1 次上游调用；不同 name 各自独立计数；
- [ ] 上游失败且有缓存时返回缓存值；无缓存时返回 `{ ok: false, status: null }`（200）；
- [ ] 某一 name 上游持续失败时，其余 name 仍正常返回。

### 3.3 页面/界面描述

本期无页面变更（纯 API）。

### 3.4 异常与边界情况

| 情况 | 预期行为 |
|------|----------|
| 未知 `name` | 404 `{ error }`，不请求上游 |
| `name` 大小写变体（如 `Viridis`） | 视为未知 name，404（白名单精确匹配，与契约枚举一致） |
| 上游超时（>5s）/ 网络错误 / 非 2xx | stale-if-error，无缓存则 200 `{ ok: false, status: null }` |
| 上游返回非法 JSON 或无法确定 `live` 布尔 | 同上游失败处理 |
| 上游缺 `title` / `startedAt` 字段 | 对应字段为 null，`live` 正常返回 |
| 同期主播未开播 | 上游正常返回，归一化后 `{ live: false, … }`（属正常数据，非错误） |
| 既有 `GET /api/live/status` | 路径段数不同（3 段 vs 4 段），不受新端点影响 |

## 四、非功能需求

### 4.1 性能

- 30s 短 TTL 缓存，前端轮询不会放大上游压力；单次上游请求 5s 超时；
- 无数据库读写，无持久化。

### 4.2 安全性

- 端点公开（`security: []`），与会话体系无交互；
- name→roomId 映射服务端内置白名单，**不接受客户端传入房间号或 URL**，杜绝 SSRF；
- 上游地址经 env 注入（内置缺省值），房间号不出现在响应与客户端可见位置。

### 4.3 兼容性

- 纯新增端点，不改既有端点行为；契约向后兼容（仅新增 path）。

## 五、依赖与约束

### 5.1 依赖

- 上游内网直播数据服务 `GET /api/b/live/{roomId}/state/current`（与既有 live-status 同一上游服务，已交付）；
- 既有 live-status 实现（`servers/api/src/routes/liveStatus.ts` 归一化函数、`src/infra/liveStatusCache.ts` 缓存抽象），可直接复用。

### 5.2 约束

- 契约先行：先改 `contract/live-status.openapi.yaml`，实现与测试以契约为准；
- 不改数据库、不持久化直播状态；
- 本期仅交付 API；前端展示（公开页同期开播卡片等）为后续需求，本期不得在 UI 中出现占位入口。

## 六、后续可能（本期不做）

- 公开页展示同期主播开播状态（依赖本端点）；
- 同期主播列表可配置化（新增/移除 name 不改代码）；
- 批量查询端点（一次返回全部同期状态）；
- 开播 Webhook / 开播通知。

## 七、相关文档

- 本期技术提案：`docs/engineering/proposals/2026-09-07-peer-live-status-proposal.md`
- 契约：`contract/live-status.openapi.yaml`
- 后端直播域 Spec（现态）：`docs/engineering/spec/backend-live.md`
