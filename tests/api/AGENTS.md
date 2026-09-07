# tests/api

枝堇Sumire 后台鉴权与用户管理 API 集成测试（黑盒）。技术栈：TypeScript + Vitest + Node 内置 `fetch`，手工 Cookie jar。

开发与运行前加载 API 契约 `contract/backdoor-auth.openapi.yaml`、`contract/live-history.openapi.yaml`、`contract/live-events.openapi.yaml`、技术方案 `docs/engineering/proposals/2026-08-12-backdoor-auth-proposal.md`（§8.2）。用例只依据契约与 PRD 编写，禁止对照 `servers/` 实现编写。

## 运行方式

```bash
cd infra/aspire && aspire start                    # 拉起 bookstore + api + redis + mongodb
aspire describe api --output json                  # 取 api http endpoint
cd tests/api && API_BASE_URL=http://localhost:<api-port> \
  BOOKSTORE_ORIGIN=http://localhost:<bookstore-port> \
  pnpm vitest run
```

`API_BASE_URL` 必需；`BOOKSTORE_ORIGIN` 仅 CORS 用例需要。

### live-history 用例（含 stub 上游）

`src/live-history.test.ts` 依赖 API 的上游指向本机 stub（测试进程内起 HTTP stub 于固定端口，默认 `9876`），并直连 Redis 清理缓存 key `live-history:latest`：

```bash
# 起 Aspire 时把 api 上游指向 stub（含完整路径，测试端口非默认需一致）
cd infra/aspire && LIVE_HISTORY_UPSTREAM_URL=http://127.0.0.1:9876/api/b/live/1727076670/history aspire start
aspire describe api --output json && aspire describe redis --output json
cd tests/api && API_BASE_URL=http://localhost:<api-port> \
  REDIS_URL=<redis-connection-string> \
  LIVE_HISTORY_STUB_PORT=9876 \
  pnpm vitest run src/live-history.test.ts
```

- `REDIS_URL` 用于用例间清理缓存（缺失则跳过清理，缓存相关用例可能串扰）；
- `LIVE_HISTORY_STUB_PORT` 缺省 `9876`，须与 Aspire 启动时注入的 `LIVE_HISTORY_UPSTREAM_URL` 端口一致；
- stub 上游模拟真实分页信封形态 `{ total, page, pageSize, items }`（`items` 含额外字段与缺字段条目），与上游真实结构一致；API 取数应携带 `page=1&pageSize=100`。

### live-events 用例（含 stub 上游）

`src/live-events.test.ts` 依赖 API 的直播事件上游指向本机 stub（测试进程内起 HTTP/SSE stub 于固定端口，默认 `9877`，与 live-history 的 `9876` 隔离）：

```bash
# 起 Aspire 时把 api 直播事件上游 base URL 指向 stub（端点路径由 api 侧拼接，端口非默认需一致）
cd infra/aspire && LIVE_EVENTS_UPSTREAM_URL=http://127.0.0.1:9877 aspire start
aspire describe api --output json
cd tests/api && API_BASE_URL=http://localhost:<api-port> \
  LIVE_EVENTS_STUB_PORT=9877 \
  pnpm vitest run src/live-events.test.ts
```

- `LIVE_EVENTS_STUB_PORT` 缺省 `9877`，须与 Aspire 启动时注入的 `LIVE_EVENTS_UPSTREAM_URL` 端口一致；
- stub 上游模拟真实事件信封 `{ roomId, type, occurredAt, liveSessionId, payload }`（range 分页端点 + subscribe SSE 端点），与上游真实结构一致；
- 已读状态持久化在 MongoDB（`live_event_reads`），用例均只断言操作后的当前状态，可重复运行；
- SSE 心跳用例需真实等待 30s 心跳，单用例超时 45s。

### live-status 用例（含 stub 上游）

`src/live-status.test.ts` 依赖 API 的直播状态上游指向本机 stub（测试进程内起 HTTP stub 于固定端口，默认 `9878`，与 9876/9877 隔离）：

```bash
# 起 Aspire 时把 api 直播状态上游指向 stub（含完整路径，测试端口非默认需一致）
cd infra/aspire && LIVE_STATUS_UPSTREAM_URL=http://127.0.0.1:9878/api/b/live/1727076670/state/current aspire start
aspire describe api --output json && aspire describe redis --output json
cd tests/api && API_BASE_URL=http://localhost:<api-port> \
  REDIS_URL=<redis-connection-string> \
  LIVE_STATUS_STUB_PORT=9878 \
  pnpm vitest run src/live-status.test.ts
```

- `REDIS_URL` 用于用例间清理缓存（缺失则跳过清理，缓存相关用例可能串扰）；
- `LIVE_STATUS_STUB_PORT` 缺省 `9878`，须与 Aspire 启动时注入的 `LIVE_STATUS_UPSTREAM_URL` 端口一致；
- stub 上游模拟直播状态信封（live/offline/invalid/hang 等模式），与契约口径一致；API 归一化返回 `{ ok, status }`；
- 同期直播状态（`GET /api/live/:name/status`）复用同一 9878 stub，stub 同时响应三个同期房间路径（viridis→1727071052、komichi→1700301235、chu2u→1727074031），按房间独立计数；
- 同期端点缓存键 `live-peer-status:{name}`（TTL 30s），与本人端点 `live-status:latest` 隔离；
- 运行同期用例需额外注入 `LIVE_PEER_STATUS_UPSTREAM_URL=http://127.0.0.1:9878`（base URL，端点路径由 api 侧拼接）。

## 目录

- `src/client.ts`：fetch 封装、`CookieJar`（解析/回带 sumire_sid）、登录/建号助手、就绪轮询
- `src/login.test.ts`、`logout.test.ts`、`session.test.ts`、`change-password.test.ts`、`users.test.ts`、`stream-plans.test.ts`、`live-history.test.ts`、`live-events.test.ts`、`surface.test.ts`

## 约定

- 测试基态：超管 `supersumire` / 初始密码 `salamander`；**不改其种子密码**（保留基态）；
- 创建/改密类用例用带随机后缀的用户名（`t_<uuid8>` 等），避免用例间冲突；
- 限速用例最后执行（`fileParallelism: false` 全局串行 + `sequential`）。
