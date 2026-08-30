---
description: 首页视觉效果优化实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/home-visual-overhaul，唯一开发分支 feat/home-visual-overhaul。契约先行新增 contract/live-status.openapi.yaml；后端照搬 live-history 公开读代理范式新增 GET /api/live/status（Redis live-status:latest TTL 30s + stale-if-error 200 降级）；前端 app/(site)/page.tsx 重构为 100svh 不可滚动封面页（立绘右半宽×上半高裁剪、文案块左下、NavBar 全屏宽、单行右下 Footer、新增 LiveStatus/TodaySchedule 组件、移除入口卡/速览条/本周日程大卡），globals.css @theme 按 #b4a6bf 重设调色盘并新增 --text-* 字阶 token 整体上调，profile.yaml 按萌娘百科补充字段；单测/API 黑盒（stub 端口 9878）/e2e 全覆盖，spec 与设计文档同 PR 同步。
type: Permanent
---

# 首页视觉效果优化实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-31-home-visual-overhaul-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-31-home-visual-overhaul-proposal.md]]（v1.0）
**关联设计**: [[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
**需求总分支**: `prd/home-visual-overhaul`
**开发分支**: `feat/home-visual-overhaul`（自需求总分支切出，**唯一开发分支**，契约/后端/前端/测试全部实现同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-08-31）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支 `prd/home-visual-overhaul` 核对代码现态）：

- 首页 `apps/bookstore/app/(site)/page.tsx`（139 行）：hero grid 容器 `min-h-svh w-full max-w-6xl ... lg:grid-cols-[1.1fr_1fr]`（`:39`）；文案列四段 `animate-rise` 错峰入场（`:42-67`）；`ColorChip` 引用于 `:68`；立绘容器 `absolute inset-x-0 bottom-0 top-16 ... lg:relative`（`:72`），`Image` 有 `priority`、`object-contain` + 底部渐变 mask（`:73-80`）；`EntryCard`×3（`:90-109`）；`{API_CONFIGURED && <WeeklySchedule />}`（`:114`）；信息速览条 `PaperCard + dl`（`:117-136`）。全页限宽统一 `max-w-6xl px-5 lg:px-10`。
- 布局 `app/(site)/layout.tsx`：`NavBar`（`:14`）、`main.min-h-svh`（`:15`）、`Footer site={site}`（`:16`）。
- NavBar（`components/NavBar.tsx`，Client）：内容容器限宽 `mx-auto flex h-16 w-full max-w-6xl ... px-5 lg:px-10`（`:53`，**改 w-full 去 max-w-6xl 即达 F4**）；毛玻璃 `scrolled || open` 切换（`:47-51`）；`BASE_LINKS`（`:15-20`）+ tools 映射；移动端汉堡面板（`:92-109`）。
- Footer（`components/Footer.tsx`，SC）：签名仅 `{ site }`（`:4`，**无 floating 参数，本期新增**）；三行结构——免责声明（`:10-12`）、三外链 `site.links.bilibili/live/moegirl`（`:13-38`，`rel="noreferrer"`）、应援色行（`:39-50`，本期移除）。
- `features/home/` 仅 `ColorChip.tsx`（被引仅 `page.tsx:6,68`）、`EntryCard.tsx`（被引仅 `page.tsx:7,90,96,102`）、`WeeklySchedule.tsx`（131 行，`listPlans(周一,周日)` 周视图）；**无 `features/home/api.ts`**，本期新建；`API_BASE_URL`/`API_CONFIGURED` 源头为 `features/backdoor/api.ts:16-21`。
- 日程请求层 `features/schedule/api.ts`：`listPlans(from?, to?)`（`:66-75`，`YYYY-MM-DD` query），内部 `request` 未配置短路 `{status:0}` + `credentials:"include"`（`:40-63`）。
- 样式 `app/globals.css`：`@theme` 于 `:9-45`（`--color-primary: #b4a6bf` 于 `:11`，其余 night/raised/soft/paper/ink/flower/vine/eye/crimson/gold 于 `:15-33`）；**无 `--text-*` 字阶 token**，body 未设字号（`:47-50`，浏览器默认 16px），页面散用 Tailwind 内置字阶类；`--animate-rise` token（`:41`）+ `@keyframes rise`（`:126-135`）；`prefers-reduced-motion` 仅关氛围动效（`:160-173`）。
- 内容：`content/profile.yaml`（`:2-77`，likes/dislikes/games/milestones/anecdotes/links）；Zod schema `lib/content/schemas.ts` `profileSchema`（`:33-59`）；`/about` 喜好区块 `tagGroups`（`app/(site)/about/page.tsx:58-62`）+ Tag 渲染（`:143-158`）。`content/site.yaml` links：`bilibili/live/moegirl`（`:7-10`）。
- 前端测试：`vitest.config.ts` node 默认 + jsdom pragma + `tests/unit/**`；`tests/unit/footer-link.test.tsx` 断言无 `/backdoor` 链接（保持绿）；`tests/unit/home-weekly-guard.test.tsx` 断言首页挂载 `WeeklySchedule`（**首页移除后须删除/改写**）。
- e2e：`tests/e2e/src/bookstore/` 仅 `calendar.spec.ts` 与 `footer-link.spec.ts`，**无 `site.spec.ts`**；`calendar.spec.ts:74-81`（`home-entry-to-calendar`）断言首页「本周日程」heading 并点击进 `/calendar`（**首页移除后须改写为直接访问 `/calendar`**）；配置形态见 `tests/e2e/AGENTS.md`——Aspire 经 `apphost.cs:37` 注入 `NEXT_PUBLIC_API_BASE_URL`（`API_CONFIGURED=true`），另有 `playwright.unconfigured.config.ts` 静态伺服未配置形态（`API_CONFIGURED=false`）。
- 后端范式：`servers/api/src/routes/liveHistory.ts`——归一化纯函数导出（`isLiveRecord`/`extractItems`/`normalizeRecords`，`:16-48`）、路由工厂 `createLiveHistoryRouter(deps)`（`:58-63`）、处理链 `router.get("/")`（`:83-112`：缓存命中直回 → fetch 5s 超时 `:91-93` → 错误入 catch → 成功写缓存 → catch 内 stale-if-error 重读缓存 → 200 降级体 `{ok:false,records:[]}`，永不 5xx）；缓存抽象 `infra/liveHistoryCache.ts`（接口 + Redis 实现 + `createMemory*` 缺省，`:4-37`）；装配 `app.ts` `AppDeps`（`:16-25`）+ `api.use("/live-history", ...)`（`:56-62`）；config 内置缺省不得抛错（`config.ts:27-31`）；index.ts 单例 Redis 注入（`:19-24`）。
- 后端测试：`servers/api/tests/liveHistory.test.ts`——`vi.stubGlobal("fetch", fetchSpy)` 打桩（`:155-163`，**现状以全局 stub 为准而非 deps.fetchFn**）、手工构造 req/res 调 app（`:58-80`）、`memCache()` 带 store 断言（`:45-56`）。
- API 黑盒：`tests/api/src/live-history.test.ts`——`node:http` stub、`STUB_PORT = env ?? "9876"`（`:15`）、模式 `records|invalid|non-array|hang`（hang 6s 模拟超时，`:17-21`）、`REDIS_URL` 清缓存（`rediss://` TLS `rejectUnauthorized:false`，`:111-125`）；`tests/api/AGENTS.md`：stub 端口按域隔离（9876/9877 → **本域用 9878**）、`fileParallelism:false`、用例只依据契约与 PRD 编写。
- 编排：`infra/aspire/apphost.cs`——api `.WithEnvironment` 链式注入（`LIVE_HISTORY_UPSTREAM_URL` 于 `:26-27`：编排进程 env 优先，缺省回退内网地址）。
- 契约模板：`contract/live-history.openapi.yaml`（45 行）——`security: []` 公开读（`:13`）、仅 `200` 一个响应、降级语义写进 description、信封 schema 收 `components.schemas`。

整体顺序（契约先行，之后**后端轨与前端轨可并行 subagent**，e2e 与文档同步收尾）：
**切开发分支 → 契约 live-status.openapi.yaml →〔后端轨：路由+缓存+装配（TDD）→ 编排注入 → tests/api 黑盒〕∥〔前端轨：内容/schema → 请求层 → 组件 TDD → page 重构 → 调色盘字阶〕→ e2e 更新 + spec/设计文档/AGENTS.md 同步 + 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 首页布局 | 可滚动多区块（hero + 入口卡×3 + WeeklySchedule + 速览条），`max-w-6xl` 限宽 | `100svh` 占满一屏不可滚动；立绘右半宽×上半高裁剪（移动端全宽）；文案块左下；直播状态/今日日程组件首屏；footer 单行右下 |
| 直播状态 | 无 | `GET /api/live/status` 公开读代理（Redis 30s + stale-if-error 200 降级，永不 5xx）+ 首屏组件点击跳直播间 |
| 今日日程 | 仅 WeeklySchedule 周视图大卡（首页） | 轻量「今日日程」组件（复用 `listPlans(today,today)`），首页大卡移除，`/calendar` 不受影响 |
| NavBar/Footer | NavBar 限宽 `max-w-6xl`；Footer 三行多行排版 | NavBar 全屏宽；Footer 单行（免责声明移动端隐藏 + 三外链），首页贴边右下 |
| 调色盘/字号 | `@theme` 色 token 现表；无字阶 token，body 默认 16px | 围绕 `#b4a6bf` 重设衍生色阶；新增 `--text-*` 字阶 token 并整体上调；全站生效、后台回归 |
| 静态文案 | profile.yaml 现字段 | 按萌娘百科补 `bookAnimeTypes/musicTypes/gameGenre`/新逸闻；schema 与 `/about` 展示同步 |
| ColorChip/EntryCard | 首页引用 | 全站移除（文件删除） |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/home-visual-overhaul`；
- 开发工作（契约 + 后端 + 前端 + 全部测试）在**唯一开发分支** `feat/home-visual-overhaul` 上进行（自 `prd/home-visual-overhaul` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/home-visual-overhaul` 切出 `feat/home-visual-overhaul` 并推送 origin。

**验证**：`git branch --show-current` 为 `feat/home-visual-overhaul`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：契约 `contract/live-status.openapi.yaml`（契约先行）

加载 `docs/engineering/backend-rules.md`。照搬 `contract/live-history.openapi.yaml`（45 行）模板新增契约：

1. `openapi: 3.1.0`；`info.description` 写明「单一事实源」「服务端代理内网上游并做归一化与短 TTL 缓存；上游地址与房间号不出现在客户端可见位置」；
2. `paths./api/live/status.get`：`security: []`（公开读）；无参数（roomId 服务端内置固定 `1727076670`）；**仅 `200` 一个响应**，description 写明「上游不可达/超时/返回非法时降级为 200 + `{ ok: false, status: null }`，不产生 5xx」；
3. 响应 schema：`required: [ok, status]`；`status` 可空；`components.schemas.LiveStatus`：`live`（boolean，必填，归一化唯一强保证字段）、`title`/`startedAt`（可空，上游缺字段时为 `null`，防御式可选）；description 注明归一化与降级语义、上游真实结构实现阶段实测后回写。

**验证**：契约 YAML 可解析（`pnpm -C servers/api exec yaml` 或任一解析器过一遍）；与 PRD F5 验收口径逐条对照无遗漏。

### 步骤 2：后端 live-status 路由（TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md`。

1. **`src/config.ts`**：仿 `:27-31` 加 `liveStatusUpstreamUrl: getEnv("LIVE_STATUS_UPSTREAM_URL", "http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current")`（内置缺省、不得抛错）；
2. **`src/infra/liveStatusCache.ts`**：照搬 liveHistoryCache 三件套——`LiveStatusCache { get(key); set(key, value, ttlSeconds) }` 接口 + `RedisLiveStatusCache`（复用传入 ioredis）+ `createMemoryLiveStatusCache()`；
3. **`src/routes/liveStatus.ts`**：缓存键 `live-status:latest`、TTL 30s、超时 5000ms；导出归一化纯函数（servers/api 无 zod，手写类型守卫）：从上游响应防御式提取 `live` 布尔与可选 `title`/`startedAt`，信封结构实现阶段实测后定型（参照 online-count 教训），解析失败视为上游失败；`createLiveStatusRouter(deps: { upstreamUrl, cache, fetchFn? })` 处理链照搬 liveHistory `:83-112`：缓存命中直回 → fetch（`AbortSignal.timeout(5000)`）→ `!upstream.ok`/解析失败抛错 → 成功写缓存回 `{ ok: true, status }` → catch 内 stale-if-error 重读缓存，仍无 → `200 { ok: false, status: null }`，**永不 5xx**；
4. **装配**：`app.ts` `AppDeps` 加可选 `liveStatusCache?: LiveStatusCache`；挂载两段式路径 `api.use("/live/status", createLiveStatusRouter({ upstreamUrl: config.liveStatusUpstreamUrl, cache: deps.liveStatusCache ?? createMemoryLiveStatusCache() }))`（PRD 指定的 `live/status` 两段式，与既有 kebab-case 域根的层次差异按 PRD 实现）；`index.ts` 注入 `new RedisLiveStatusCache(redis)`。

**测试先行** 新建 `servers/api/tests/liveStatus.test.ts`（仿 liveHistory.test.ts：`vi.stubGlobal("fetch", fetchSpy)` + 手工 req/res + `memCache()`）：
- 正常：上游 200 → 归一化 `{ ok: true, status: { live, title, startedAt } }`，缓存写入键 `live-status:latest`；
- 缓存命中不发上游（`fetchSpy` 未被调）；
- 上游 500 / 非法 JSON / 结构非法（缺可归一化字段）/ 超时 → 200 + `{ ok: false, status: null }`；
- stale-if-error：首次无缓存失败后，第二次失败回旧缓存；
- `title`/`startedAt` 缺失时归一化为 `null` 不报错；config 缺省回退（`vi.stubEnv` + 动态 import）。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿。

### 步骤 3：编排注入 + API 黑盒测试

1. **`infra/aspire/apphost.cs`**：仿 `:26-27` 为 api 追加 `.WithEnvironment("LIVE_STATUS_UPSTREAM_URL", Environment.GetEnvironmentVariable("LIVE_STATUS_UPSTREAM_URL") ?? "http://vtuber.internal.fffdan.com/api/b/live/1727076670/state/current")`；
2. **`tests/api/src/live-status.test.ts`**（SKILL: z-test；加载 `tests/api/AGENTS.md`，用例只依据契约与 PRD）：仿 live-history 黑盒——`node:http` stub 于独立端口 **9878**（`LIVE_STATUS_STUB_PORT ?? "9878"`，与 9876/9877 隔离），模式 `live|offline|invalid|hang`（hang 6s 模拟超时，记录 `stubCalls`）；`LIVE_STATUS_UPSTREAM_URL=http://127.0.0.1:9878/... aspire start` 起编排，端点经 `aspire describe api --output json` 获取；`beforeEach` 经 `REDIS_URL` 清 `live-status:latest`（TLS `rejectUnauthorized:false`）；
3. 断言：未登录 200 可访问；正常体 `{ ok:true, status.live }` 布尔且字段口径符合契约；缓存命中 stub 调用数不变；上游非 2xx/非法/hang 超时 → 200 + `{ ok:false, status:null }` 不产生 5xx。

**验证**：`pnpm -C tests/api test -- live-status` 全绿（Aspire 编排环境下）。

### 步骤 4：静态文案更新（F11）

加载 `apps/bookstore/AGENTS.md`。内容仅官方公开信息、禁止二次设定：

1. `content/profile.yaml`：补 `bookAnimeTypes`（通俗文学/悬疑/恐怖/奇幻/冒险/中式）、`musicTypes`（东方系列/术力口/电子纯音/r&b）、`gameGenre`（模拟经营）；`anecdotes` 追加「小姨驾到」（2026-08-12 直播中妹妹意外进入直播间，弹幕疯狂喊「小姨」）；既有字段与词条核对，不一致处以词条为准；
2. `lib/content/schemas.ts` `profileSchema`：新增三字段为可选/列表（`z.array(z.string())` / `z.string()` 可选项，口径与既有 `likes/games` 一致）；
3. `app/(site)/about/page.tsx`：`tagGroups`（`:58-62`）扩展展示新字段（沿用 Tag 排版）。

**测试先行** 扩展/新建内容 schema 单测：新字段解析通过；缺失时缺省回退不报错。

**验证**：`pnpm -C apps/bookstore test` 全绿；`pnpm -C apps/bookstore build` 绿。

### 步骤 5：前端请求层 `features/home/api.ts`

新建 `apps/bookstore/features/home/api.ts`：从 `@/features/backdoor/api` 导入 `API_BASE_URL`/`API_CONFIGURED`；`getLiveStatus(): Promise<{ ok: boolean; status: { live: boolean; title: string | null; startedAt: string | null } | null }>`——未配置短路 `{ ok:false, status:null }`；`fetch(`${API_BASE_URL}/api/live/status`, { credentials: "include" })`；任何失败静默降级 `{ ok:false, status:null }`（仿 `listLiveHistory` 的静默口径，`features/schedule/api.ts:105-117`）。

**测试先行** 新建 `tests/unit/home-live-status-api.test.ts`：未配置短路；200 正常体透传；非 2xx/异常静默降级。

**验证**：`pnpm -C apps/bookstore test -- home-live-status-api` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 6：LiveStatus 与 TodaySchedule 组件（TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`（仅 `@theme` token 色、尊重 `prefers-reduced-motion`）。

1. **`features/home/LiveStatus.tsx`**（Client）：`API_CONFIGURED` 守卫未配置返回 `null`；初始渲染固定尺寸骨架（与实际内容同尺寸防 CLS）；`useEffect` 调 `getLiveStatus()`；三态渲染——「直播中」（状态点 + 点睛色，可用 `animate-pulse` token）、「未开播」、降级/失败中性态（视同未开播但文案中性，不报错）；整体 `<a href={liveUrl} target="_blank" rel="noopener">` 点击跳直播间（liveUrl 由服务端 props 自 `site.links.live` 传入）；样式基于被移除的 ColorChip 药丸语言改造；
2. **`features/home/TodaySchedule.tsx`**（Client）：`API_CONFIGURED` 守卫；复用 `listPlans(today, today)`（本地时区当天 `YYYY-MM-DD`，与日历页口径一致；不混入历史直播）；渲染「今日日程」标题 + 当天计划 `HH:mm 主题`；无计划/请求失败展示空态「今日暂无安排」；固定尺寸骨架。

**测试先行** `tests/unit/home-live-status.test.tsx` 与 `tests/unit/home-today-schedule.test.tsx`（jsdom pragma，mock `@/features/backdoor/api` 的 `API_CONFIGURED` getter 仿 `home-weekly-guard.test.tsx:7-11`）：
- LiveStatus：`API_CONFIGURED=false` 不渲染；直播中/未开播/降级三态；链接 `href/target/rel` 正确；骨架占位存在；
- TodaySchedule：守卫不渲染；空态文案；有计划渲染时间+主题；`listPlans` 失败静默为空态；骨架占位存在。

**验证**：`pnpm -C apps/bookstore test -- home-` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 7：NavBar 全屏宽 + Footer 单行（TDD）

1. **`components/NavBar.tsx`**：内容容器 `:53` 去 `max-w-6xl` 改全宽（保留 `px-5 lg:px-10`）；毛玻璃/移动端菜单/链接高亮行为不变；
2. **`components/Footer.tsx`**：重构为单行 `flex`——免责声明（`hidden sm:inline` 移动端不展示）+ 三外链（数据源 `site.links` 不变，新窗口 + `rel="noopener noreferrer"`），移除应援色行（`:39-50`）；新增可选 `floating?: boolean` 参数——首页调用方传 `floating` 时以贴边右下呈现（供 page.tsx 绝对定位容器使用），非首页保持流式底部单行；保持 Server Component；
3. `tests/unit/footer-link.test.tsx` 既有断言（无 `/backdoor` 链接）保持绿；扩展断言单行内容：三外链 href 正确、免责声明带移动端隐藏类。

**验证**：`pnpm -C apps/bookstore test -- footer` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 8：首页 page.tsx 一屏重构 + 连带测试更新

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。

1. **`app/(site)/page.tsx` 重构**为 `h-svh overflow-hidden` 相对定位封面页：
   - 立绘：桌面 `absolute right-0 top-0 h-1/2 w-1/2`、移动端 `inset-x-0 w-full`；`Image` 改 `object-cover object-top`（顶部锚定裁剪、不变形），保留 `priority`，移除底部渐变 mask；
   - 文案块（期数/枝堇/Sumire/bio）`absolute` 左下，padding 桌面 > 移动端，保留四段 `animate-rise` 错峰入场；移除 `ColorChip`（`:68`）；
   - LiveStatus / TodaySchedule 组件于左侧区域纵向排布（文案块上方），均 `{API_CONFIGURED && ...}` 守卫（组件内亦有守卫，双保险）；
   - Footer 以 `floating` 形态 `absolute` 右下贴边；
   - 移除：EntryCard 区（`:88-109`）、`{API_CONFIGURED && <WeeklySchedule />}`（`:114`）、速览条（`:117-136`）、`VineDivider grow` 与 `max-w-6xl` 容器；移动端按「立绘(顶部50%) → 组件 → 文案 → 链接行」纵向紧凑排布（flex/grid + `min-h-0`），375×667 为下限验收视口；
2. **删除文件** `features/home/ColorChip.tsx`、`features/home/EntryCard.tsx`（全仓 grep 确认无其他引用）；
3. **连带测试更新**：
   - `tests/unit/home-weekly-guard.test.tsx`：首页不再挂载 WeeklySchedule——删除该文件，或改写为「首页不渲染 WeeklySchedule/EntryCard/速览条；文案块与 bio 存在；`API_CONFIGURED` 守卫下 LiveStatus/TodaySchedule 挂载与否」的首页结构守卫测试；
   - `tests/e2e/src/bookstore/calendar.spec.ts:74-81`（`home-entry-to-calendar`）：首页「本周日程」入口已移除——改写为直接访问 `/calendar` 的用例（导航栏仍有日历链接，另补导航入口断言）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；本地 `aspire start` 手工走查桌面（1280×800）与移动（375×667）一屏无滚动、无溢出、无遮挡。

### 步骤 9：调色盘与字阶（globals.css）

加载 SKILL: frontend-design、`docs/design/01-visual-identity.md`、`docs/design/02-page-design.md`。

1. `@theme` 色 token 围绕 `#b4a6bf` 重设衍生色阶（`--color-primary` 值不变；night/raised/soft/paper/ink 等明度/饱和度调整至简约协调，具体色值设计定稿并同步 `docs/design/01`）；文字/背景对比度满足 WCAG AA（正常文本 ≥ 4.5:1）；
2. 新增 `--text-*` 字阶 token（display/h1/h2/body/small/caption，对照设计文档字阶）并**整体上调**（如 body 0.875→1.0rem、caption 0.75→0.875rem，以设计定稿为准）；页面散用的 Tailwind 内置 `text-6xl/7xl` 等替换为字阶 token；
3. 全部样式仍仅 `@theme` token 色，无硬编码色值；
4. **全站回归**：`/about`、`/assets`、`/calendar`、`/backdoor` 视觉走查不破裂（共享 token 调整，后台必须回归）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore build` 全绿；`aspire start` 走查上述页面；grep 确认无新增硬编码色值。

### 步骤 10：e2e、Spec 同步与收尾验收

1. **e2e**（SKILL: z-test）新建 `tests/e2e/src/bookstore/site.spec.ts`：首页断言——一屏无纵向滚动（`document.documentElement.scrollHeight <= innerHeight` 容差口径）、文案块/bio 可见、无入口卡/速览条/本周日程、footer 单行三链接、（配置形态下）直播状态与今日日程组件存在且直播状态链接指向 `live.bilibili.com/1727076670`；未配置形态（`playwright.unconfigured.config.ts`）断言两组件不渲染、首页其余完整；`/calendar`、`/about` 回归（`/about` 展示新增喜好字段）；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：
   - `docs/product/spec/site-pages.md`：首页一屏封面页现态（布局/组件/移除项/footer 形态）；
   - `docs/product/spec/calendar.md`：首页不再内嵌周日程大卡的口径（如有所述）；
   - `docs/engineering/spec/backend-live.md`：新增 `## GET /api/live/status（公开）` 小节 + 「端点」表与「存储汇总」（Redis 新键 `live-status:latest`）同步；
   - `docs/engineering/spec/frontend-bookstore.md`：`features/home/` 模块现态（LiveStatus/TodaySchedule/api.ts、移除 ColorChip/EntryCard、WeeklySchedule 不再上首页）、字阶 token 现态；
   - `docs/engineering/spec/infra.md`、`docs/engineering/spec/testing.md`：`LIVE_STATUS_UPSTREAM_URL` 与 stub 端口 9878 同步；
   - `docs/design/01-visual-identity.md`、`docs/design/02-page-design.md`：新调色盘/字阶与首页一屏布局定稿同步；
   - `apps/bookstore/AGENTS.md`、`servers/api/AGENTS.md`、`tests/api/AGENTS.md`：对应口径记录同步（如 WeeklySchedule 不再由首页挂载、`/api/live/status` 口径、stub 端口清单）；
3. 上游真实响应结构经实测后，归一化口径回写 `contract/live-status.openapi.yaml` 与 spec；
4. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过；`pnpm lint && pnpm test && pnpm build`（apps/bookstore、servers/api）与 tests/api、e2e 全绿；
5. 推送 `feat/home-visual-overhaul` 并提 PR 至 `prd/home-visual-overhaul`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：内网上游 `state/current`（结构需实测，防御式解析）；既有 `GET /api/stream-plans`（今日日程数据源）；`features/schedule/api.ts` 请求层；`content/site.yaml` 外链单一事实源；既有 Redis 单实例与 Aspire 四资源编排。
- **并行协调**：契约（步骤 1）完成后，后端轨（步骤 2-3）与前端轨（步骤 4-9）可并行 subagent；步骤 3 的 tests/api 黑盒依赖步骤 2 与 Aspire 编排；步骤 10 的 e2e 依赖前端轨完成。
- **风险**（对应提案 §5.2 与核对发现）：
  - **上游结构未知**：归一化必须防御式（手写类型守卫，servers/api 无 zod）；实测后回写契约与 spec（online-count PRD v1.1 教训）；
  - **移动端一屏空间紧张**：组件尺寸收紧（字号/间距在字阶上调后仍需在一屏内收敛），375×667 为下限验收视口；超矮视口核心元素（立绘/文案/直播状态）优先；
  - **共享 token 全站生效**：调色盘/字阶调整必须回归 `/backdoor` 等全部页面；对比度按 WCAG AA 校验；
  - **连带测试**：`home-weekly-guard.test.tsx` 与 `calendar.spec.ts` 的 `home-entry-to-calendar` 用例断言首页「本周日程」，移除后必须在步骤 8 同步改写，否则测试红；
  - **hydration/CLS**：两 Client 组件骨架与实际内容同尺寸；`API_CONFIGURED=false` 不渲染、不留占位（构建时守卫 + 组件内守卫双保险）；
  - **路径层次差异**：`/api/live/status` 为 PRD 指定两段式路径，与既有 kebab-case 域根（`/api/live-history`）不同，按 PRD 实现并在 spec 中记录；
  - **内容红线**：profile.yaml 仅官方公开信息，禁止二次设定，与萌娘百科词条逐字段核对。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-31-home-visual-overhaul-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-31-home-visual-overhaul-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]；后端规范：[[../backend-rules.md]]
- 设计文档：[[../../design/01-visual-identity.md]]、[[../../design/02-page-design.md]]
- 产品 Spec（现态）：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`
- 工程 Spec（现态）：`docs/engineering/spec/backend-live.md`、`frontend-bookstore.md`、`infra.md`、`testing.md`
- 契约模板：`contract/live-history.openapi.yaml`
- 参考先例：[[../proposals/2026-08-21-online-count-proposal.md]]（内网上游实测教训）；[[2026-08-28-danmaku-vote-impl-plan.md]]（上一迭代实现方案）
