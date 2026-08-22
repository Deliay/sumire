# Integration 验收报告 — PR #74

- **PR**: https://github.com/Deliay/sumire/pull/74 （integration → release）
- **审查范围**: `git diff release...integration`（14 文件，+944/-18）+ 返工轮工作区改动（2 修改 + 2 新增，见「返工轮」节）
- **包含功能**: 直播间在线人数展示——契约 `LiveEventType` 扩展 `online_rank_count`；服务端 `GET /api/live-events` 对该类型透传上游原始信封（不归一化）、`/stream` 以命名帧 `event: online_rank_count` 透传；前端新增 `useOnlineCount`（首取 REST + SSE 事件驱动 + 5s leading+trailing 节流）与 `OnlineCountText`，弹幕看板普通/全屏双页头标题尾随展示（PRD `docs/product/requirements/draft/2026-08-21-online-count-prd.md`，提案 `docs/engineering/proposals/2026-08-21-online-count-proposal.md`，实现方案 `docs/engineering/plans/2026-08-21-online-count-impl-plan.md` v1.1）
- **验收日期**: 2026-08-22
- **验收结论**: ❌ **打回（第四轮复验）** —— 上游返工未落实第三轮打回要求：D1–D3 三项缺陷在代码中原样存在（见「第四轮复验」节），打回上游按 v1.2 新设计返工
- **修订记录**: 2026-08-22 首轮验收因 M1（前端单元测试按实现方案整体缺失）打回；第二轮复验单测补齐后通过（补跑 Aspire 编排 tests/api 与 e2e 全量）；第三轮下游真实环境实测发现 3 项缺陷（双 SSE 连接、在线人数不展示、重复 GET），打回上游；第四轮复验发现返工产物仅落实首轮 M1/m2（补单测 + `status !== 200` 判断），D1–D3 未修复，相关文档（PRD v1.1 / impl-plan v1.2 / spec / 契约描述）已由本节点按新设计修订，再次打回

## 第四轮复验（2026-08-22，打回）

上游返工产物（见上游「修复说明」：新增 hook/text/page 单测 17 例、`useOnlineCount` 两处 `status !== 200` 判断）仅对应**首轮** Review 意见（M1/m2），对第三轮打回的 D1–D3 **零修复**。逐条代码核对（工作区现态）：

| # | 打回要求 | 代码现态 | 结论 |
|---|---|---|---|
| D1 单连接 | `online_rank_count` 并入看板唯一 SSE 连接 | `useOnlineCount.ts:94` 仍自建第二条 `EventSource` 单订 `online_rank_count`；`useLiveEventStream.ts:40` 看板连接照旧——页面 `/api/live-events/stream` 仍 2 条连接 | ❌ 未修复 |
| D2 直接解析帧取数 | 从命名帧 `payload.online_count` 直接读取，移除「帧触发再 GET」 | `useOnlineCount.ts:99-102` 仍为「帧仅作触发器、不解析 payload、触发节流重新 GET」；真实上游 range 查不到该类型 → 在线人数恒不展示 | ❌ 未修复 |
| D3 刷新至多 1 次 GET | SSE 不再触发 GET | 首取 leading + 上游即推帧触发 trailing，刷新仍 2 次 `GET ?type=online_rank_count&page=1&pageSize=1` | ❌ 未修复 |

**本节点已完成的文档修订**（作为上游返工依据，均在工作区未提交）：

- PRD `docs/product/requirements/draft/2026-08-21-online-count-prd.md` → **v1.1**：F1/F2 改为「SSE 命名帧直取 `payload.online_count`、并入看板唯一连接、range 首取仅作兜底至多 1 次」，验收标准同步；
- impl-plan `docs/engineering/plans/2026-08-21-online-count-impl-plan.md` → **v1.2**：步骤 3 重写（`useLiveEventStream` 扩展命名帧透出 + `useOnlineCount` 帧取数 + 页面装配单连接）、步骤 4 e2e stub 口径（range 对该类型默认空 items，改由命名帧推送数值）、§4 风险新增 D1–D3 条目；
- spec：`docs/product/spec/danmaku.md`、`docs/engineering/spec/frontend-bookstore.md` 在线人数与 `useLiveEventStream` 段改为新设计口径；
- 契约 `contract/live-events.openapi.yaml`：`GET /api/live-events` description 中「在线人数取数用法」改为「stream 命名帧为主取数通道，range 仅兜底且须容忍空 items」（服务端行为不变，仅描述口径）；
- `apps/bookstore/AGENTS.md` 弹幕看板约定段同步。

**上游返工要求**：

1. 按 impl-plan v1.2 步骤 3 实现：`useLiveEventStream` 订阅类型追加 `online_rank_count` + 命名帧监听解析透出；`useOnlineCount` 删除自建 EventSource，直接消费透出信封取 `payload.online_count`，5s 节流作用于数值更新；首取兜底至多 1 次 GET。全页面 `/stream` 仅一条连接。
2. 单测按 impl-plan v1.2 步骤 3.1 调整（帧解析更新而非触发 GET；`useLiveEventStream` 命名帧透出用例）；e2e stub 按步骤 4 调整（range 默认空 items、命名帧推送数值）。
3. 修复后重跑 `pnpm -C apps/bookstore test`、`tests/api`、`tests/e2e` 全量。
4. **提交推送**：本轮文档修订与上轮返工改动（2 修改 + 2 新增）至今均为本地 integration 工作区未提交状态（origin/integration 仍停在 e0ce34f），本次修复请一并提交推送到 integration 分支，否则 PR #74 合入的仍是被打回的旧内容。

## 下游实测打回（第三轮，真实环境）

下游在真实上游环境实测发现以下 3 项问题，e2e/集成测试因 stub 上游行为与真实上游不一致而全部漏检：

| # | 现象 | 根因分析 |
|---|---|---|
| D1 | `/api/live-events/stream` 有 **2 次**连接，`online_rank_count` 单独订阅 | `useLiveEventStream.ts:40` 已订阅看板四类事件，`useOnlineCount.ts:94` 又自建第二条 EventSource 单订 `online_rank_count`。服务端 `/stream` 本就支持多 type 混订与命名帧透传，应并入同一条连接 |
| D2 | 全屏/非全屏均**看不到在线人数** | 设计口径「SSE 帧仅作触发器、数值仍经 GET 取数」（`useOnlineCount.ts:99`）在真实上游不成立：`GET /api/live-events?type=online_rank_count` 依赖上游 **range（历史检索）**端点返回该类型信封，而 `online_rank_count` 是实时推送帧，历史检索查不到 → items 恒空 → `onlineCount` 恒 null → `OnlineCountText` 永不渲染。stub 上游让 range 返回了该类型，故测试全绿 |
| D3 | 刷新页面出现 **2 次** `GET /api/live-events?type=online_rank_count&page=1&pageSize=1` | 首取 leading 一次 + SSE 连接后上游即推当前在线人数帧、触发 trailing 节流再 GET 一次（dev 下 StrictMode 双挂载另有 1 次被取消的请求）。SSE 帧本身就携带 `payload.online_count`，无需再 GET |

**修复要求（上游）**：

1. **单连接**：`online_rank_count` 并入看板既有 SSE 订阅（`useLiveEventStream` 订阅类型追加 + 命名帧 `online_rank_count` 监听，事件透出给页面/`useOnlineCount`），全页面 `/api/live-events/stream` 仅一条连接。
2. **直接解析 SSE 帧取数**：`online_count` 从命名帧 `payload.online_count` 直接读取（帧即完整信封），移除「帧触发再 GET」设计；首取 REST 可保留作首屏兜底（有则显示、无则等首帧），但刷新至多 1 次 GET。
3. 同步更新契约描述/impl-plan/PRD 与 spec（`frontend-bookstore.md`、`backend-live.md`、`danmaku.md`）中「SSE 仅作触发器、数值经 GET」的口径；单测/e2e stub 相应调整（e2e stub 的 range 分支不应再被在线人数路径依赖）。
4. 修复后重跑：`pnpm -C apps/bookstore test`、`tests/api`、`tests/e2e` 全量。

## 返工轮改动核对（第二轮）

| 要求 | 交付 | 核对结果 |
|---|---|---|
| 新增 `danmaku-online-count-hook.test.ts` | 11 用例：未配置 API 恒 null、首取取值、items 空/online_count 缺失/NaN/Infinity、非 200（401）、失败保留最后成功值、SSE 命名帧触发重新 GET、5s leading+trailing 节流、卸载 es.close() 且不再发请求、EventSource 连接参数（URL + withCredentials） | ✅ 覆盖 impl-plan 3.1 全部要点，MockEventSource/假定时器结构合理 |
| 新增 `danmaku-online-count-text.test.tsx` | 3 用例：null 不渲染 / 1521 文本 / 0 边界 | ✅ |
| 扩展 `danmaku-page.test.tsx` 双页头断言 | +3 用例：mock useOnlineCount，普通页头展示、全屏页头展示、null 时双页头均不展示 | ✅ |
| m2：`useOnlineCount` 增加 `status === 200` 判断 | 两处 `request().then()` 均改为解构 `status` 并非 200 直接 return | ✅ 与 impl-plan 口径一致，并有「请求非 200 → null」用例锁定 |

**注意**：返工改动当前为本地 integration 工作区**未提交**状态（`git status`：2 修改 + 2 新增，origin/integration 仍停在 e0ce34f）。合入 release 前必须先将这些改动提交并推送到 integration 分支，否则 PR #74 实际合入的仍是上轮被打回的内容。

## 测试验证结果

| 套件 | 命令 | 结果 |
|---|---|---|
| bookstore lint | `pnpm -C apps/bookstore lint` | ✅ 0 error（3 个既有 warning，非本 PR 引入） |
| bookstore 单元测试 | `pnpm -C apps/bookstore test` | ✅ 45 文件 **377/377** 通过（360 + 新增 17：hook 11 + text 3 + page 3） |
| bookstore 构建 | `pnpm -C apps/bookstore build` | ✅ 静态导出 14 路由全部生成 |
| api 单元测试 | `pnpm -C servers/api test` | ✅ 13 文件 222/222 通过 |
| tests/api 集成（Aspire 编排全栈实跑，stub 上游注入） | `API_BASE_URL=… REDIS_URL=… LIVE_*_STUB_PORT=… pnpm vitest run` | ⚠ 100/105 通过；5 例失败**证实为存量问题**（详见 m4），本 PR 新增 4 例 online_rank_count 用例全部通过 |
| e2e（Playwright，Aspire 编排全栈实跑） | `BOOKSTORE_BASE_URL=… API_BASE_URL=… pnpm test` | ✅ **51 通过 / 8 跳过**（较上轮 +2：`online-count-show`、`online-count-fail-hide` 实跑通过） |

## 问题清单

### Blocker

无。

### Major

无（上轮 M1 已修复）。

### Minor

| # | 位置 | 问题 |
|---|---|---|
| m1 | `servers/api/src/routes/liveEvents.ts:139-141` | （沿自上轮，未处理）混订（如 `type=danmaku&type=online_rank_count`）时响应 items 为「归一化条目在前、透传信封统一后置」，与 impl-plan「与其余归一化条目**保序**混存」的表述不符；契约/spec 未承诺混存顺序，在线人数实际用法（单类型 pageSize=1）不受影响。建议后续对齐为保序分流，或修订 impl-plan 措辞 |
| m4 | `tests/api/src/live-events.test.ts`（5 例：gift-v2 ×3、pagination、sse-read-merged） | **存量测试缺陷（非本 PR 引入）**：三例 gift_v2 用例以 `?type=gift&type=gift_v2` 请求，但 `gift_v2` 从来不是契约查询枚举（契约/spec 口径为四类 + 本轮扩展的 online_rank_count，`type=gift` 由服务端展开为 `["gift","gift_v2"]` 透传上游），API 正确返回 400 而用例期望 200；pagination 用例期望 total=32，与 gift→gift_v2 展开后的 36 不符；sse-read-merged 断言首两帧为 `gift:batch-stub-5/4`，实际 occurredAt 倒序下首帧为 gift_v2 事件。**实证**：将 release 分支原样测试文件对当前 API 复跑，失败用例完全相同（5/5），且这些断言在 release 代码路径上同样不成立。历史验收（PR #63/#71）均未实跑 tests/api，缺陷自引入起潜伏至今。建议另开修复：gift_v2 三例改为只传 `type=gift` 并断言上游展开，pagination 期望改为 36，sse-read-merged 改用不混入 gift_v2 的断言方式 |

### Follow-up（不阻塞）

| # | 位置 | 问题 |
|---|---|---|
| m3 | `docs/product/requirements/draft/`、`docs/engineering/proposals/`、`docs/engineering/plans/` | （沿自上轮）归档未闭环：danmaku-search-v2 与本期 online-count 的 PRD/proposal/impl-plan 在本 PR 合入 release 后均满足归档条件，应一并移入各自 `archived/` |

## 与 PRD 的差距

**直播间在线人数展示 PRD**（§1.3 成功标准逐条核对）：

- 打开看板后标题旁展示「当前直播间在线 {online_count} 人」：✓ 实现符合，e2e `online-count-show` 实跑通过
- 事件到达后节流刷新：✓ SSE 命名帧触发 + 5s leading+trailing 节流，本轮已有单测锁定（节流、SSE 触发、竞态清理）
- 无数据/失败时不展示、无占位：✓ null 不渲染、失败保留最后成功值，e2e `online-count-fail-hide` 实跑通过 + 单测覆盖
- 全屏模式页头同样展示：✓ 双页头断言已有单测
- 既有能力零回归：✓ bookstore 377 单测 + api 222 单测 + 构建 14 路由 + e2e 51 通过；tests/api 5 例失败证实为存量（m4），非本 PR 回归

差距项：无阻塞差距。m1（混订保序措辞）与 m4（存量测试缺陷）记录为 Minor。

## 合规性审查（文档/spec/契约）

- 契约同步：`contract/live-events.openapi.yaml` `LiveEventType` 枚举扩展、`LiveEventOrEnvelope`/`UpstreamEnvelope` schema 与实现一致 ✓；第四轮已将 `GET /api/live-events` description 的「在线人数取数用法」口径修订为「stream 命名帧为主、range 兜底且容忍空 items」（服务端行为不变）
- spec 同步：`docs/engineering/spec/backend-live.md`、`docs/engineering/spec/frontend-bookstore.md`、`docs/product/spec/danmaku.md` 已经本节点修订为 v1.2 新设计口径——**当前领先于代码实现**，待上游按 impl-plan v1.2 返工落地后即为现态一致
- `apps/bookstore/AGENTS.md` 弹幕看板约定段同步为新设计口径（同领先于实现）✓
- 返工轮代码改动（单测 + m2）与 impl-plan v1.1 口径对齐，但 v1.2 新设计要求的 D1–D3 修复未落实 ✗

## 结论与建议

**验收打回（上游返工）。** 第二轮代码级验收结论（M1 已修复、各套件全绿、tests/api 5 例失败证实为存量 m4）维持不变；第三轮下游真实环境实测暴露的 D1–D3 三项功能缺陷，经第四轮复验确认**未修复**（返工产物仅落实首轮 M1/m2）。新设计已落入文档（PRD v1.1 / impl-plan v1.2 / spec / 契约描述），打回上游按 impl-plan v1.2 返工：单条 SSE 连接、命名帧直取 `payload.online_count`、刷新至多 1 次兜底 GET，并将全部未提交改动一并推送 integration。

上游返工并重新提交后，下一轮验收将复跑 bookstore 单测、tests/api 与 e2e 全量，并重点核对：单条 `/stream` 连接、真实上游口径下在线人数可展示、刷新至多 1 次 GET。合入后请闭环 m3 归档 follow-up。
