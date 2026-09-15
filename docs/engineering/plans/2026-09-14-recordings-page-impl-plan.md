---
description: 录播页实现方案 v1.0——基于 PRD v1.1 与技术提案 v1.1 的实施计划。需求总分支 prd/recordings-page，唯一开发分支 feat/recordings-page，纯前端变更（仅 apps/bookstore + 部署工作流一行 env），无契约/后端/编排资源变更。TDD 串行推进：features/recordings/api.ts 基址注入与降级封装（NEXT_PUBLIC_RECORDINGS_BASE_URL 独立门控 RECORDINGS_CONFIGURED）→ 导航 +「录播」门控项 −「小密室」、Footer +「小密室」（site.links secretRoom 必填化）→ 页面壳 + 录制状态 30s 轮询与 mpegts.js 听直播单例 → 按直播间折叠 + pageSize=20 前端分页录播列表 → FLV 播放区（isSupported 降级 + 原生下载）→ e2e page.route mock → deploy.yml 注入生产基址 + spec 同步收尾。
type: Permanent
---

# 录播页实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-14-recordings-page-prd.md]]（v1.1）
**关联技术提案**: [[../proposals/2026-09-14-recordings-page-proposal.md]]（v1.1）
**需求总分支**: `prd/recordings-page`（需求总 PR：<https://github.com/Deliay/sumire/pull/129>）
**开发分支**: `feat/recordings-page`（自需求总分支切出，**唯一开发分支**，实现/单测/e2e/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-14）
**作者**: sumire workflow

本方案将技术提案 v1.1 落实为可执行的实施计划，遵循 TDD（每个功能步骤先补失败用例再实现）。纯前端功能：无契约、无 `servers/api`、无编排资源变更；数据通路为浏览器直连录播服务（线上 CDN 已为站点源配置跨域，本地开发内部接口走转发）。

**前提事实**（已在需求总分支 `prd/recordings-page` 核对代码现态，commit 1b3dcc8）：

- 导航现态：`apps/bookstore/components/NavBar.tsx`——链接项模型为联合类型 `NavLink`（`:36`）= `BaseLink`（`:17-27`，含 `anchor`/`route`/`sectionId`/`kind:"internal"`）+ `ExternalLink`（`:29-34`，仅服务「小密室」）；`EXTERNAL_LINKS` 常量（`:38`）仅含「小密室」一项；`links` 组装顺序 `[...baseLinks, ...ongoingLink, ...tools.map, ...EXTERNAL_LINKS]`（`:90-107`），`ongoingLink`（棉花糖 `/topics`，`API_CONFIGURED` 门控，`:92-94`）即「录播」项的插入参照位；`isActive`（`:111-121`）非首页走 `pathname === link.route` 精确匹配、`hrefOf`（`:124-127`）非 `tool-` 前缀返回 `anchor`、`handleNavClick`（`:130-140`）仅 `sectionId` 非空时派发 deck 事件——「录播」项无 `sectionId`，三函数零改动即满足行为；桌面端渲染 `:160-188`、移动端折叠菜单 `:201-229`，共用同一 `links` 与外链分支。
- Footer 现态：`apps/bookstore/components/Footer.tsx:9-13` 把 `site.links`（`bilibili`/`live`/`moegirl` 三字段，`lib/content/schemas.ts:8-19`，均 `z.url()`）组装为外链数组渲染；站点数据在 `apps/bookstore/content/site.yaml`；`(content)/layout.tsx:13` 为非首页渲染 `<Footer site={site}/>`，`/recordings` 置于该路由组即自动获得外壳。既有单测夹具内联 `links` 对象：`tests/unit/footer-link.test.tsx:15`、`home-visual-fx.test.tsx:91,147`、`home-weekly-guard.test.tsx:61,84`。
- 降级先例：`features/backdoor/api.ts:16-21` 定义 `API_CONFIGURED`（`NEXT_PUBLIC_API_BASE_URL` 非空即配置），calendar 页 `page.tsx:11-13` 未配置时 `return <NotFoundPage />`——录播页不复用此口径（语义是后台 API），按提案新建 `RECORDINGS_CONFIGURED` 独立门控，但沿用「页面壳守卫 + api 层短路不 fetch」双保险模式（`apps/bookstore/AGENTS.md:40-41`）。
- 静默降级先例：`features/home/api.ts:18-34` `getLiveStatus()` 未配置/失败均返回 `{ok:false,status:null}`；呼吸点语义色 `bg-eye animate-pulse`（`LiveStatus.tsx:63-72`，token 定义于 `app/globals.css:32`）可直接复用于录制中标识。
- 单测设施：`tests/unit/nav-bar.test.tsx` 已有 `configured`/`mockPathname`/`matchMediaStub` mock 与 describe「外链 小密室」（`:153-227`，5 用例）；本步骤将其改写为 Footer 断言属接口变更的正常测试更新。vitest 配置 `apps/bookstore/vitest.config.ts`（jsdom 用 `// @vitest-environment jsdom` 头注释）。
- e2e 先例：`tests/e2e/src/bookstore/calendar.spec.ts:144-153` 的 `page.route` + `route.fulfill` JSON 夹具模式；`playwright.config.ts:8` `baseURL = process.env.BOOKSTORE_BASE_URL ?? "http://localhost:3000"`，无 webServer（服务由 Aspire 统一管理）。
- 依赖现态：`apps/bookstore/package.json` 无 mpegts.js/flv.js，`pnpm -C apps/bookstore add mpegts.js` 为唯一新增运行时依赖。
- 部署注入点：`.github/workflows/deploy.yml:46-50`「Build static site」步已注入 `NEXT_PUBLIC_API_BASE_URL: https://api.sumire.live`，`NEXT_PUBLIC_RECORDINGS_BASE_URL: https://recordings.vtuber.fffdan.com` 同位追加一行。
- 本地联调：`infra/aspire/apphost.cs:41-47` 经 `WithEnvironment("NEXT_PUBLIC_API_BASE_URL", api.GetEndpoint("http"))` 向 bookstore 注入；录播基址为外部服务、无编排资源，本地经 `apps/bookstore/.env.local`（gitignore）注入转发后的内网地址，不改 apphost.cs（对齐提案 §9.1「无新增编排资源」）。
- Spec 同步位置：`docs/product/spec/site-pages.md:30` 导航锚点化小节（含「小密室」外链现态描述，需改写）；`docs/engineering/spec/frontend-bookstore.md:9` `API_CONFIGURED` 门控口径、`:189` NavBar `EXTERNAL_LINKS`/`isExternal` 模型描述（需改写）。

整体顺序（**串行**，唯一开发分支 `feat/recordings-page`）：
**切开发分支 → api.ts 封装（TDD）→ 导航/Footer 调整（TDD）→ 页面壳 + 状态列表/听直播（TDD）→ 折叠分页录播列表（TDD）→ FLV 播放区（TDD）→ e2e → 部署 env + spec 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.1 / 提案 v1.1） |
|----|-----------------|----------------------------------------|
| 路由 | `(site)/(content)/` 下仅 about/assets/calendar/topics | 新增 `recordings/page.tsx` 服务端壳（metadata + `RECORDINGS_CONFIGURED` 守卫 + `<RecordingsApp />` 客户端组件） |
| 录播取数 | 无 | `features/recordings/api.ts`：`RECORDINGS_CONFIGURED`/基址注入、`joinUrl` 归一拼接、`getRecordingStatus()`/`getRoomRecordings(roomId)` 降级封装（`{ok:false}` 风格对齐 getLiveStatus）、`fileName` 经 `encodeURIComponent` |
| 导航 | 棉花糖后接工具项，末尾外链「小密室」（`EXTERNAL_LINKS`） | 棉花糖同组、工具项之前插入「录播」项（`RECORDINGS_CONFIGURED` 门控，无 `sectionId` 不触发 deck）；移除 `EXTERNAL_LINKS`/`ExternalLink`/`isExternal` 与两处外链渲染分支 |
| Footer | links 三项（bilibili/live/moegirl） | `schemas.ts` links 增 `secretRoom: z.url()`、`site.yaml` 补值 `https://sumire.icu`、Footer 数组末尾追加「小密室」；三处既有测试夹具 links 对象同步补字段 |
| 录制状态/听直播 | 无 | F2：30s 轮询 + `visibilitychange` 暂停/恢复即刷；F3：录制中房间「听直播」，mpegts.js 挂隐藏 `<video>` 播 `live-stream/audio`，全局单例 |
| 录播列表 | 无 | F4：按直播间折叠分组（名单来自 recording-status items），展开按需拉取一次、前端分页 pageSize=20、createdAt 倒序、分组内错误重试 |
| 在线预览/下载 | 无 | F5：`FlvPlayerPanel` mpegts.js 顺序流播放（`isLive:false`）、`isSupported()=false` 展示降级提示 + 下载；下载为 `<a href download>` 命中上游 `Content-Disposition` |
| 依赖 | 无 mpegts.js | 新增 `mpegts.js` 唯一运行时依赖 |
| 配置 | 无录播基址 | 构建期 `NEXT_PUBLIC_RECORDINGS_BASE_URL`；deploy.yml 生产注入外网地址；本地 `.env.local` 注入内网转发地址 |
| 文档 | spec 无录播页记录 | 同 PR 同步 `site-pages.md`、`frontend-bookstore.md`；`apps/bookstore/AGENTS.md` 补录播 feature 与环境变量口径；根 `AGENTS.md` 无变更 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/recordings-page`；
- 开发工作（实现 + 单测 + e2e + spec 同步）在**唯一开发分支** `feat/recordings-page` 上进行（自 `prd/recordings-page` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步；
- 开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`；前端规则要点：全部页面 SSG、`app/` 只做路由组装、业务组件放 `features/<模块>/`、样式只用 `@theme` token 色禁硬编码、提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/recordings-page` 切出 `feat/recordings-page` 并推送。

**验证**：`git branch --show-current` 为 `feat/recordings-page`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：录播请求封装（features/recordings/api.ts，TDD）

单测先行（红）：新增 `apps/bookstore/tests/unit/recordings-api.test.ts`（node 环境即可，纯 fetch 封装），`vi.stubEnv("NEXT_PUBLIC_RECORDINGS_BASE_URL", ...)` 控制基址 + `vi.stubGlobal("fetch", spy)`：

1. 未配置基址时 `RECORDINGS_CONFIGURED=false`，`getRecordingStatus()`/`getRoomRecordings()` 直接返回 `{ ok: false, items: [] }` / `{ ok: false, files: [] }` 且 fetch 零调用（双保险之 api 层短路）；
2. 正常响应归一化：`streamer.name → streamerName`、`state` 未知值归一为 `"not_live"`、缺 `sessionTitle` 归一为 `null`、去 `hostName`/`error` 内部字段；
3. 非 200 / 非法 JSON / fetch reject 均降级为 `{ ok: false, ... }`，不抛错；
4. `joinUrl`：基址带/不带末尾斜杠均拼出单斜杠路径；
5. 文件名含中文/空格时请求路径经 `encodeURIComponent`（暴露 `recordingFileUrl(roomId, fileName)` / `liveAudioUrl(roomId)` 供组件与下载链接复用，单测断言编码结果）。

实现（绿）：`apps/bookstore/features/recordings/api.ts`——模块级读取 `process.env.NEXT_PUBLIC_RECORDINGS_BASE_URL ?? ""` 导出 `RECORDINGS_BASE_URL` 与 `RECORDINGS_CONFIGURED`；导出提案 §3 的 `RecordingStatusItem`/`RecordingFile` 类型与上述五个函数；防御式归一化（对齐 liveStatus 先例）；不带凭据（公开只读独立基址，不复用 `features/backdoor/api.ts` 的 `request()`）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-api.test.ts` 全绿。

### 步骤 2：导航与 Footer 调整（TDD）

单测先行（红）：

1. `nav-bar.test.tsx`：mock 设施上追加 `vi.mock("@/features/recordings/api")` 以 `recordingsConfigured` 开关控制；新增用例——「录播」项渲染且 `href="/recordings"`；`mockPathname="/recordings"` 时该项 `aria-current`、其他路由无；`recordingsConfigured=false` 时不渲染（对照既有日历门控用例 `:110-116`）；首页内点击「录播」不派发 `sumire:navigate`（对照 `:76-87` spy 范式）；移动端双份渲染（对照 `:142-150`）；
2. `nav-bar.test.tsx` describe「外链 小密室」（`:153-227`）整组改写：删除导航外链断言，改为断言导航（桌面 + 移动）均不再出现「小密室」；
3. `footer-link.test.tsx`：新增「小密室」用例——`getByRole("link", { name: "小密室" })` 断言 `href="https://sumire.icu"`、`target="_blank"`、rel 含 `noopener` 与 `noreferrer`；夹具 links 补 `secretRoom`；
4. 既有夹具更新：`home-visual-fx.test.tsx`（`:91,147`）、`home-weekly-guard.test.tsx`（`:61,84`）links 对象补 `secretRoom` 字段（schema 必填化的连锁更新，不改用例逻辑）。

实现（绿）：

1. `NavBar.tsx`：`ongoingLink` 同组追加录播项 `{ navKey: "recordings", label: "录播", anchor: "/recordings", route: "/recordings", kind: "internal" }`（`recordingsConfigured` 门控，插入于工具项之前）；`isActive`/`hrefOf`/`handleNavClick` 零改动（无 `sectionId` 天然不触发 deck、精确匹配天然覆盖 `/recordings`）；删除 `EXTERNAL_LINKS` 常量、`ExternalLink` 类型、`isExternal` 谓词与桌面/移动两处外链渲染分支（「小密室」为唯一外链使用方，移除后无残留引用，`links` 回到纯 `BaseLink[]`）；
2. `lib/content/schemas.ts` links 增 `secretRoom: z.url()`；`content/site.yaml` 补 `secretRoom: "https://sumire.icu"`；
3. `Footer.tsx` links 数组末尾追加 `{ href: site.links.secretRoom, label: "小密室" }`（复用既有 `<a target="_blank" rel="noopener noreferrer">` + ExternalLink 图标渲染）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿（含新用例转绿、既有导航用例零回归）。

### 步骤 3：页面壳 + 录制状态列表与听直播（F2/F3，TDD）

先 `pnpm -C apps/bookstore add mpegts.js`（唯一新增运行时依赖，单独提交）。

单测先行（红）：新增 `tests/unit/recordings-page.test.tsx`（jsdom），mock `@/features/recordings/api`（可控 status 响应）与 `mpegts.js`（`vi.mock`，暴露 `createPlayer` spy / `isSupported` 开关）：

1. `RECORDINGS_CONFIGURED=false`：页面渲染「服务未配置」空态、api 函数零调用；
2. 状态列表渲染：主播名、录制中/未在直播文案、`sessionTitle`、更新时间；录制中项有呼吸点标识（`bg-eye` 类断言）；
3. 轮询：fake timers 推进 30s 触发第二次拉取；`document.hidden=true` + 派发 `visibilitychange` 后不再拉取，恢复可见立即拉一次；
4. 听直播：录制中房间渲染「听直播」按钮，未在直播房间不渲染；点击后 `mpegts.createPlayer` 以 `{ type: "flv", isLive: true, url: liveAudioUrl(roomId) }` 调用一次；播放中按钮变「停止」；点击另一房间时旧 player `destroy` 被调、新 player 创建（单例）；组件卸载 `destroy`；
5. 降级：fetch 失败时状态区展示「录播服务暂时不可用」空态，不报错页。

实现（绿）：

1. `app/(site)/(content)/recordings/page.tsx`：Server Component，`export const metadata`（标题「录播」+ 简介）；`if (!RECORDINGS_CONFIGURED) return <RecordingsEmpty reason="unconfigured" />` 守卫（对齐 calendar 页 `:11-13` 先例，但展示空态而非 404——PRD §3.4「服务未配置空态」），否则渲染 `<RecordingsApp />`；守卫内不发请求由步骤 1 的 api 短路兜底；
2. `features/recordings/RecordingsApp.tsx`：客户端组装（状态列表 + 录播列表 + 播放区三区，`max-w-6xl` 居中容器）；
3. `features/recordings/RecordingStatusList.tsx`：`useEffect` 首拉 + `setInterval(30_000)`，`visibilitychange` 监听（隐藏清定时器、可见即拉）；渲染项含主播名/状态药丸（录制中 `bg-eye animate-pulse` 呼吸点，复用 LiveStatus 语义色）/`sessionTitle`/相对更新时间；
4. `features/recordings/LiveAudioButton.tsx`：录制中渲染按钮；点击经播放器单例（`features/recordings/player.ts`：模块级 `currentPlayer` ref，`play(url, videoEl)` 前 destroy 旧实例，错误事件回调复位 UI）挂到隐藏 `<video>`；「停止」复位；卸载即断流；
5. 视觉遵循 `docs/design/02-page-design.md`：深色卡片、焦点环 `--color-flower`、按钮键盘可达。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-page.test.tsx` 全绿；`pnpm -C apps/bookstore build` 通过。

### 步骤 4：录播列表（F4，TDD）

单测先行（红）：`tests/unit/recordings-groups.test.tsx`（jsdom，同 mock 设施）：

1. 默认仅渲染分组头（直播间名 + 折叠指示），未展开时 `getRoomRecordings` 零调用；
2. 点击展开：拉取一次并渲染文件列表（文件名、人性化大小、创建时间，createdAt 倒序）；再次点击折叠；多分组可同时展开；
3. 已展开分组重复展开/折叠不重复请求（spy 计数为 1）；
4. 分页：构造 21+ 条夹具，首页 20 条 + 分页控件；翻页 slice 本地数据（fetch 计数不变）；
5. 分组加载失败：仅该分组内展示错误态 + 「重试」，重试后成功渲染，其他分组不受影响；
6. 空列表：展开后展示「暂无录播」。

实现（绿）：`features/recordings/RoomRecordingsGroup.tsx`——分组头按钮（`aria-expanded`）+ 展开态 `useState` 缓存已拉取数组；`createdAt` 倒序后 slice 分页（pageSize=20，页码本地 state）；加载/错误/重试三态；`RoomRecordingsList.tsx` 如需拆分则按文件规模定（保持简单优先单文件）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-groups.test.tsx` 全绿。

### 步骤 5：FLV 播放区（F5，TDD）

单测先行（红）：并入 `tests/unit/recordings-groups.test.tsx` 或独立 `flv-player-panel.test.tsx`（视规模，取简单者）：

1. 点击文件项：播放区出现，`mpegts.createPlayer` 以 `{ type: "flv", isLive: false, url: recordingFileUrl(roomId, fileName) }` 调用；切换文件时旧 player `destroy`；
2. 播放区含播放/暂停、音量、只读进度展示、关闭按钮；关闭后 player `destroy`；
3. `isSupported()=false`：播放区展示「当前浏览器不支持在线播放，请下载后收听」+ 下载按钮，不创建 player；
4. 播放错误事件：展示错误提示且列表交互不受影响；
5. 下载：文件项「下载」为 `<a href={recordingFileUrl(...)} download>`，href 与播放同源、文件名经编码；
6. 组件卸载：player `destroy`（与 F3 共用单例管理）。

实现（绿）：`features/recordings/FlvPlayerPanel.tsx`——接收当前选中 `{ roomId, file }`，经步骤 3 的播放器单例管理 mpegts.js 实例（`isLive: false`、禁 seek、进度条只读展示已播放时长）；`mpegts.isSupported()` 为 false 时渲染降级块；下载链接复用 `recordingFileUrl()`；**实现期复验上游 Range 行为**（直连与经 CDN 各试一次，提案实现点 2）：若支持 Range 再放开 seek，否则保持顺序流。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 6：e2e（tests/e2e/src/bookstore/recordings.spec.ts）

加载 SKILL: z-test。对齐 `calendar.spec.ts:144-153` 的 `page.route` + `route.fulfill` 模式，拦截录播基址下四个端点路径返回夹具（recording-status 两房间一录制中一未在直播；recordings 21 条验证分页；fileName 与 audio 流以桩响应即可）：

1. 导航「录播」点击进入 `/recordings`、导航项选中态；
2. 状态列表渲染两房间、录制中房间有「听直播」；
3. 折叠展开加载文件列表、翻页不重复请求（`page.on("request")` 计数，对照 `calendar.spec.ts:54-63` 的 `expect.poll` 观察范式）；
4. 下载链接 href 指向正确编码的录播文件 URL；
5. 降级：recording-status 返回 500 时页面展示空态不白屏；
6. 真实媒体播放不在 e2e 断言（流式媒体不稳定），以「player 初始化被调用」桩断言替代（提案 §8.1）。

e2e 运行需要 bookstore 以录播基址指向可拦截的任意源启动（`page.route` 拦截在浏览器侧，基址值只需非空）；运行方式遵循 `tests/e2e` 既有 Aspire 注入 `BOOKSTORE_BASE_URL` 模式，并在 bookstore 环境补 `NEXT_PUBLIC_RECORDINGS_BASE_URL`（本地 `.env.local` 或启动 env，不改 apphost.cs）。

**验证**：`cd tests/e2e && pnpm playwright test src/bookstore/recordings.spec.ts` 通过；既有 spec 不回归。

### 步骤 7：部署 env、spec 同步与收尾验收

1. `.github/workflows/deploy.yml:48-49` env 块追加 `NEXT_PUBLIC_RECORDINGS_BASE_URL: https://recordings.vtuber.fffdan.com`（与 `NEXT_PUBLIC_API_BASE_URL` 同位一行）；
2. `docs/product/spec/site-pages.md`：`:30` 导航小节改写（+「录播」门控项、−「小密室」外链），Footer 外链区 +「小密室」，新增 `/recordings` 页面现态小节（F1–F5 行为口径、降级与门控）；
3. `docs/engineering/spec/frontend-bookstore.md`：`:9` 门控口径补 `RECORDINGS_CONFIGURED` 与 `NEXT_PUBLIC_RECORDINGS_BASE_URL`；`:189` NavBar 模型小节改写（移除 `EXTERNAL_LINKS`/`isExternal`，补录播项位置与门控）；新增 recordings feature 模块小节（api 封装、播放器单例、mpegts.js 依赖、四端点消费口径）；Footer links 模型补 `secretRoom`；
4. `apps/bookstore/AGENTS.md`：补录播 feature 与 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 环境变量口径（对齐 `:40-41` 既有门控双保险描述）；根 `AGENTS.md` 无变更（无结构与契约变更）；
5. 核对 PRD §1.3 成功标准、§3.2 各 F 验收标准与提案 §10 全量通过；
6. 推送 `feat/recordings-page`，提 PR 回合 `prd/recordings-page`（需求总 PR #129 随之更新）。

**验证**：`pnpm lint && pnpm test`（workspace 级）+ `pnpm -C apps/bookstore build` 全绿；e2e 录播 spec 通过；PRD/提案验收清单逐项勾选。

## 4. 依赖与风险

- **依赖**：录播服务内/外网可用且四端点形态稳定（结构按 2026-09-14 实测）；线上 CDN 跨域白名单持续覆盖 `https://sumire.live`（站点域变更需同步白名单）；新增 `mpegts.js` npm 依赖（唯一）；
- **风险**：上游 Range 支持未知（经 CDN 实测 416）——步骤 5 按顺序流 + 只读进度设计并在实现期复验，若支持则放开 seek，不阻塞主流程；
- **风险**：iOS Safari 无 MSE——`isSupported()` 降级为提示 + 下载（PRD 4.3 已接受该降级），步骤 5 用例 3 锁定；
- **风险**：`site.links` schema 必填化连锁破坏三处既有测试夹具——步骤 2 单测先行阶段同步补字段，属接口变更的正常夹具更新；
- **风险**：大文件（单场数 GB）播放/下载流量——直连上游不经本站中转（提案 §1.1），浏览器原生下载承载，前端不做整文件缓冲；
- **范围纪律**：不改 `servers/api`/契约/编排资源；录播检索、弹幕回放、iOS 完整播放均不做（PRD §六）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-14-recordings-page-prd.md]]
- 技术提案：[[../proposals/2026-09-14-recordings-page-proposal.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 前端规范：[[../frontend-rules.md]]
- 页面设计：`../../design/02-page-design.md`
