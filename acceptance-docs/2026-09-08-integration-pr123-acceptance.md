# Integration 验收报告 — PR #123

- **PR**: https://github.com/Deliay/sumire/pull/123 （integration → release）
- **审查范围**: `git diff release...integration`（228 文件，+23816/-897；release 为 integration 祖先，diff 即全部功能增量）+ 返工修复（worktree 未提交修改 3 文件）
- **包含功能**（8 个 feature 批次，均含 PRD + 提案 + 实现方案三件套）:
  1. 棉花糖 topics 全栈（契约 `topics.openapi.yaml`、服务端 topics/marshmallows/AI 审核 worker/限流/访客 Cookie、前台公开页 + 后台管理 + 演示模式）
  2. 同期直播状态 API（`GET /api/live/{name}/status` 白名单代理 + 30s 缓存降级）
  3. 周表灵活时间 timeType（fixed/tbd/allDay，契约 v1.2.0，服务端/前端/周表图三层适配）
  4. 首页视觉改版 overhaul/v3/v4（FullpageDeck 全屏翻页、视差、粒子、SectionRail、about 页重构、NavBar/Footer）
  5. 弹幕投票（danmaku-tools/vote，SSE 实时计票）
  6. 周表图片日期渲染 / 日期区域
  7. live-status 本人状态端点（`GET /api/live/status`）
  8. spec/设计文档/AGENTS.md 同步
- **验收日期**: 2026-09-08
- **验收结论**: ✅ **通过（复审）** —— 首轮打回的 2 个 Blocker 均已正确修复并验证；遗留 7 项 Major 为建议项，记录在案，建议后续 PR 跟进

## 复审记录（第二轮）

首轮结论为打回（2 个 Blocker），返工后复审结果：

### B1. timeType 判重对存量数据静默失效 —— ✅ 已修复

`servers/api/src/db/streamPlans.ts:111-122` `findStreamPlan` 已改为：`timeType === "fixed"` 时使用 `$or: [{ timeType: "fixed" }, { timeType: { $exists: false } }]` 查询，同时匹配新文档与无 `timeType` 字段的存量文档；非 fixed 保持精确匹配。修复方向与首轮建议一致，逻辑正确。

配套测试：`servers/api/tests/streamPlans.test.ts` 新增用例「存量文档（无 timeType 字段）参与 fixed 判重 → 409」，mock 的 `findStreamPlan` 同步实现了 fixed 兼容语义（`timeType === "fixed" || timeType === undefined"`），测试直接往 store 推入无 `timeType` 字段的存量文档后 POST 同日程断言 409。用例真实覆盖首轮回避的存量场景。

### B2. danmaku-vote e2e strict mode 必红 —— ✅ 已修复

`tests/e2e/src/backdoor/danmaku-vote.spec.ts` 三处裸 `getByText("唱歌"/"游戏")` 全部改为 `getByRole("cell", { name: "唱歌", exact: true })`：

- 核对 `VoteStatsTable.tsx:37`，选项名渲染为 `<td>{option.name}</td>`，cell role + exact 精确匹配唯一元素（票数/占比单元格为数字，不匹配）；
- `VoteOptionsEditor.tsx` 中选项名/关键字行为 `<span>`，不具 cell role，不再参与匹配，strict mode violation 消除；
- 清空投票后的 `toHaveCount(0)` 断言同样改用 cell 定位器，options 清空后表格不渲染，计数为 0 成立。

e2e 全量运行需 Aspire 编排环境，本轮未实跑；定位器唯一性已经 DOM 结构逐项核对。

### 复测结果（返工后）

| 套件 | 命令 | 结果 |
|---|---|---|
| servers/api 单测 | `pnpm -C servers/api test` | ✅ 17 文件 **267/267** 通过（含新增存量判重用例，streamPlans 28/28） |
| servers/api 类型检查 | `tsc --noEmit` | ✅ 通过 |
| bookstore 单测 | 未重跑（返工未触碰 bookstore 文件，沿用首轮 807/808，唯一失败为基线时间炸弹） | — |
| tests/e2e | 未运行（需 Aspire 编排环境） | — |

## 首轮测试验证结果（integration 提交态 `5458dab`）

| 套件 | 命令 | 结果 |
|---|---|---|
| bookstore 单元测试 | `pnpm -C apps/bookstore test` | ⚠ **807/808**，1 失败：`tests/unit/schedule-pickers.test.tsx:26`（详见"基线问题"节，**非本 PR 引入**） |
| bookstore lint | `pnpm -C apps/bookstore lint` | ✅ 0 error / 7 warning（其中 2 个 unused import 为本 PR 新引入：`CalendarView.tsx:19`、`mergeEntries.ts:2`） |
| bookstore 类型检查 | `npx tsc --noEmit` | ✅ 通过 |
| servers/api 单测 | `pnpm -C servers/api test` | ✅ 266/266 通过 |
| servers/api 类型检查 | `tsc --noEmit` | ✅ 通过 |
| tests/api 黑盒 | 未运行（需 Aspire 编排环境） | — |

## 遗留问题清单（建议后续 PR 跟进，不阻塞本次合入）

### Major（应修复）

1. **契约 `LiveStatus.title`/`startedAt` 声明 `type: string`，实现会返回 `null`** — `contract/live-status.openapi.yaml:82-87` vs `servers/api/src/routes/liveStatus.ts:75-83`。OpenAPI 3.1 下 `type: string` 不接受 null，schema 与自身 description、与实现三方矛盾；仓库既有先例 `live-events.openapi.yaml` 用 `type: [string, "null"]`。契约是单一事实源，codegen 客户端会生成非空 string。
2. **topics 契约与实现状态码不一致** — `contract/topics.openapi.yaml:226-228` 对 archived 主题调 `POST /{id}/collecting` 只定义 409，实现返回 410（`routes/topics.ts:203-206`，代码注释表明有意为之但未回改契约）；tests/api 无用例覆盖该场景。建议契约改 410 并补测试。
3. **topics 限流三维度均可被访客绕过，且每条成功投递触发一次付费 AI 调用** — `routes/topics.ts:350-369`、`visitorCookie.ts:47-56`、`app.ts:43`：clientKey 客户端自报；vid 对缺失/非法 Cookie 直接颁发新 vid；`trust proxy: true` 使 `req.ip` 取 XFF 最左端可伪造。存在成本放大路径。建议至少将 `trust proxy` 改为真实代理跳数。
4. **AI 审核无卡死恢复路径，marshmallow 可永久滞留 `pending`** — `reviewWorker.ts:115-162`、`reviewQueue.ts:33-42`：BRPOP 后崩溃 job 丢失、`JSON.parse` 失败静默丢弃、enqueue 抛错时记录已落库 pending 三条路径均无恢复；`db/marshmallows.ts:175` 的 `listPendingReview` 定义后全仓无调用方。建议启动/定时重入队超时 pending 条目。
5. **`saveVoteState` 无异常兜底，隐私模式下 backdoor 投票页崩溃白屏** — `features/danmaku-tools/vote/store.ts:34`：`setItem` 未 try/catch，Safari 隐私模式/配额满抛 `QuotaExceededError`，异常发生在持久化 `useEffect` 内无错误边界捕获。仓库既有 `weeklyImage/storage.ts:50-54` 已有同款处理模式可照抄。
6. **`useFullpageScroll` 键盘翻页不豁免可滚动内容列，与 wheel/touch 口径不一致** — `features/home/useFullpageScroll.ts:383-418`：`isInsideScrollable` 豁免用于 wheel（352）与 touch（361），唯独 keydown 未用；日历站/档案内容列溢出时键盘用户无法滚动内容列（滚轮能滚、键盘却翻页），可访问性缺陷。建议 keydown 开头加同样豁免 + 可滚动列加 `tabIndex={0}`。
7. **timeType 前端单测整体缺失，与提案 §8.1 测试策略不符** — `apps/bookstore/tests/unit/` grep `tbd|allDay|formatPlanLabel|comparePlans` 零命中：`timeType.ts`（三处排序口径的单一事实源）、`buildDaySchedulesText` 的 tbd/allDay 渲染、`mergeEntries` 混排、`PlanFormDialog` 类型联动均无单测，前端排序/格式化回归无防护网。

### Minor（建议，不阻塞）

- `liveStatus`/`livePeerStatus` 缓存损坏（非 JSON）时剩余 TTL 内持续降级不回源，建议 catch 分支删 key 回源（`liveStatus.ts:101-109`）；上游故障期无负缓存/singleflight；内存缓存兜底实现忽略 TTL（`liveStatusCache.ts:27-36`，生产恒注入 Redis，暂无实际影响）；`startedAt` 契约称 ISO 但实现任意非空字符串透传。
- `GET /api/topics/:id/public` 多返回 `aiReviewEnabled`，与契约 `TopicPublicInfo`「不含审核管理字段」及 `/public` 列表端点口径不一致（`routes/topics.ts:300`）。
- 归档主题的服务端只读约束不完整：PUT 编辑主题、PATCH marshmallows 对归档主题无校验，仅靠前端隐藏入口（`routes/topics.ts:134, 405`）。
- 已超过 endAt 的主题点「继续收集」静默无提示（`TopicDetailView.tsx:93-98`，PRD 3.4 要求提示需先改结束日期）。
- `MemoryMarshRateLimiter` 计数 Map 无过期清理，未注入 Redis 的部署形态缓慢泄漏内存（`rateLimit.ts:64-103`）。
- topics 测试缺口：限流 429、worker 重试耗尽回写 rejected、visitorCookie 均无测试；tests/api 主动清限速 key 回避 429。
- 首页 free 模式下 NavBar 失去滚动背景（`NavBar.tsx:52-57` 只监听 window scroll，deck 容器内滚动 `window.scrollY` 恒 0）。
- `docs/design/02-page-design.md` §2.1 与实现脱节（首页站无 Footer 行、免责声明移动端 `hidden`），设计文档需按实现修订。
- `features/home/WeeklySchedule.tsx` 改版后成孤儿组件（无任何挂载点，本 PR 还为其做了 timeType 适配），建议删除或明确保留理由；`TodaySchedule` 跨午夜不刷新；非活跃站内容仍可 Tab 聚焦（建议 `inert`）；移动端触摸拖拽触发视差（`useParallax.ts:135` 未按 pointerType 过滤）。
- `liveStatus` 前端类型 `title`/`startedAt` 声明必含键 `string | null`，与契约可选性不符（`features/home/api.ts:3-7`）；公开读请求带 `credentials: "include"` 徒增 CORS 面（`api.ts:23-25`）。
- `weeklyImage/layout.ts:75` 注释「同日多场按 startTime 升序」已过时（现实现为 comparePlans 口径）。
- `docs/engineering/spec/frontend-bookstore.md` 描述 ClearVoteDialog 为 `z-50`，实际 `z-[100]`（`ClearVoteDialog.tsx:45`）。
- `apps/bookstore/AGENTS.md:51` SideNav「当前 6 项」已过时，实际新增第 7 项「棉花糖」。
- `apps/bookstore/public/assets/original/AGENTS.md:15,17` 日期绘制区域说明行重复追加两次。
- `useDanmakuVote`：`start()` 无重复调用防护（重复调用建第二条 SSE 不关闭旧连接）；消息无 eventId 去重（断线重连重推时 processed 重复计数，票数因 uid 去重不受影响）；每条弹幕全量 `JSON.stringify` + `setItem` 有主线程开销。
- 公开日历 timeType e2e 缺失（TBD/全天标识只有后台路径覆盖，提案 §8.1 承诺公开日历用例）。
- 本 PR 新引入 2 个 lint warning（unused import）：`CalendarView.tsx:19`（comparePlans）、`mergeEntries.ts:2`（comparePlans、TimeType）。

### 基线问题（非本 PR 引入，记录在案）

- `apps/bookstore/tests/unit/schedule-pickers.test.tsx:26` 硬编码点击 `选择 2026-08-15`，而 DatePicker 展开的是当前月（现 2026-09），跨月后必然失败。该文件不在本 PR diff 内（`git log release..integration -- <file>` 为空），属时间炸弹型测试，建议顺手修复（用动态日期或固定系统时间 mock），当前导致 bookstore 单测套件红。

## 核对通过项（摘要）

- **契约一致性**：`stream-plans` v1.2.0（TimeType 枚举/default、startTime 条件必填、400/409 描述）与实现逐项一致；`topics` 端点/字段/枚举大面一致；`live-status` 端点/404 语义一致。
- **服务端 timeType 校验**：`parseFields` 三分支覆盖 PRD 全部边界（缺省 fixed、非法枚举 400、fixed 缺时间 400、tbd/allDay 带时间 400 文案分类型）；写库强制 tbd/allDay `startTime: null`。
- **判重语义（复审确认）**：fixed 判重兼容存量无 `timeType` 字段文档，存量零迁移承诺成立。
- **排序口径**：服务端 `comparePlans`、前端 `timeType.ts`、`mergeEntries`、`CalendarView`、`DayDetailDialog`、`TodaySchedule`、`buildDaySchedulesText` 八处一致（allDay→fixed 升序→tbd）。
- **安全**：topics markdown 渲染用 react-markdown v9 默认配置（无 rehype-raw），XSS 面安全；live-peer-status 白名单 SSRF 防护到位（name 精确匹配后才拼 URL，roomId 服务端内置）；topics 公开/后台权限边界正确。
- **前端 hook 清理**：useFullpageScroll/useParallax/GlowParticles 事件监听与 RAF 清理完整无泄漏；SSR 安全；SSG 兼容。
- **spec 同步**：`backend-topics.md`、`backend-live.md`、`backend-schedule.md`、`frontend-bookstore.md`、`topics.md`、`site-pages.md`、`backdoor.md`、`schedule-admin.md`、`calendar.md` 等均已随 PR 更新，除上述 Minor 两处小出入外与实现吻合。

## 结论

**验收通过。** 首轮打回的 2 个 Blocker 已按要求修复并验证（servers/api 267/267 通过、类型检查通过；e2e 定位器唯一性经 DOM 结构核对）。遗留 Major 7 项、Minor 若干及基线时间炸弹（schedule-pickers 日期硬编码）均记录在案，建议合并后开后续 PR 跟进，重点优先 Major 1-4（契约可空声明、契约 409/410、限流绕过 + 付费 AI 调用放大、AI 审核 pending 恢复路径）。
