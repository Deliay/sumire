# 前端架构 Spec（apps/bookstore）

Next.js 15 App Router，`output: "export"` 全静态导出（部署 GitHub Pages），TypeScript strict。

## 构建与配置

- `next.config.ts`：`basePath` 由 `NEXT_PUBLIC_BASE_PATH` 注入；`images.unoptimized`（缩略图构建期预生成）。
- 根布局加载三套 Google Fonts（Noto Serif SC / Noto Sans SC / Cormorant Garamond），metadata 模板 `%s · 堇色书屋`。
- **API 配置口径**：`API_CONFIGURED = NEXT_PUBLIC_API_BASE_URL !== ""`（`features/backdoor/api.ts`）是全局唯一判定，控制多处：`/calendar` 路由存在性、NavBar「日历」入口、首页「直播状态 / 今日日程」组件存在性。
- **录播服务配置口径**：`RECORDINGS_CONFIGURED = NEXT_PUBLIC_RECORDINGS_BASE_URL !== ""`（`features/recordings/api.ts`），独立于 `API_CONFIGURED`，控制 NavBar「录播」入口与 `/recordings` 页面守卫/请求短路。
- 未配置时双保险：`app/backdoor/layout.tsx` 直接渲染站点 404（不挂载 SessionProvider、不发请求），且 `api.ts` 的 `request()` 短路返回 `{status:0}` 不 fetch——杜绝静态站向主站自身发 `/api/*`。
- `app/globals.css` 的 `@theme` 中定义 `--animate-pulse: pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite`，覆盖 Tailwind v4 内置 2s 周期，全站 4 处骨架统一降速；`prefers-reduced-motion` 兜底不变。
- `@theme` 另定义 `--text-*` 字阶 token（`--text-display` 4rem / `--text-h1` 2.5rem / `--text-h2` 1.625rem / `--text-body` 1.0625rem / `--text-small` 0.9375rem / `--text-tiny` 0.8125rem），body 默认字号取 `--text-body`，整体较旧版本上调一档；页面标题类（`text-6xl/7xl` 等内置字阶）替换为字阶 token。

## 路由结构

- `app/(site)/`：公开页路由组（`/`、`/about`、`/assets`、`/calendar`、`/topics`、`/recordings`）。**页脚按页面形态分派**：`(site)/layout.tsx` 仅渲染 NavBar + `<main>`（不渲染 Footer）；非首页（`/about` `/assets` `/calendar` `/topics` `/recordings`，位于子路由组 `app/(site)/(content)/`）经 `(content)/layout.tsx` 渲染流式单行 `Footer`；首页 `page.tsx`（100svh 封面页）在页内底部渲染**通栏贴底毛玻璃条** `Footer floating`（免责声明全端展示）——确保首页单 footer 且不可滚动。
- `app/backdoor/`：后台路由区——`login`、`change-password`（独立卡片，无后台布局）、`(dashboard)/`（布局 = TopBar + SideNav + 内容区；子页 `page`、`users`、`schedule`、`danmaku`）。
- `app/not-found.tsx` 复用 `components/NotFoundPage.tsx`。

## 鉴权（纯客户端）

SSG 无 middleware/服务端守卫，所有守卫是体验层；安全依赖 API 侧独立鉴权。

- `SessionProvider`（`features/backdoor/session.tsx`）：状态机 `loading → authenticated | unauthenticated`；未登录访问受保护页 `router.replace` 到登录页；`mustChangePassword` 为真强制重定向改密页（login/change-password 两路径豁免防循环）。
- `RequireRole`：页面级角色守卫，权限不足跳 `/backdoor`；守卫期间渲染 `GuardLoading`，不闪内容。
- `roleAccess.ts`：层级 `superadmin(2) > admin(1) > member(0)`；`creatableRoles()`：超管可建任意、admin 仅 member。
- 所有 API 调用 `credentials: "include"`。

## 内容管道

- `content/{site,profile,assets}.yaml` + `lib/content/`：`readFileSync` + YAML + Zod 校验（`schemas.ts`：颜色 `#xxxxxx`、日期 `YYYY-MM-DD`、素材 id `[a-z0-9-]+`）+ React `cache`，构建期读取。`site.links` 含 `bilibili`/`live`/`moegirl`/`secretRoom` 四个必填 URL，其中 `secretRoom`（`https://sumire.icu`）供 Footer「小密室」外链。
- 素材 URL：`{BASE_PATH}/assets/thumbnails/{id}.webp` / `{BASE_PATH}/assets/original/{file}`；缩略图由 `scripts/generate-thumbnails.ts`（sharp，最长边 1000px、q82 webp、保透明）从 `content/assets.yaml` 驱动生成。
- `lib/tools/registry.ts` 工具注册表当前为空（无 /tools 路由，未上线功能无占位入口）。

## 日历与计划（features/schedule）

- `CalendarView` 为公开页与后台共用组件：周一开头 6×7 月网格；<640px 切周视图（单周 7 天 + 周切换 + 回到今天）。`onRangeChange` 触发父级按区间重拉计划；历史仅首载拉一次全量。
- 月视图周表头与 42 格拆为两个并列网格，格子网格 `grid-rows-6` 六行 `1fr` 等高，`DayCell` 含 `h-full min-h-16 overflow-hidden`。
- `mergeEntries.ts`：plan/history 归一化为 `CalendarEntry`；历史按 startDate **本地时区**归开播当日；缺 title/startDate 丢弃、未来历史剔除；按 date+startTime 升序混排、不去重。
- `dateUtils.ts`：一律本地时区构造 Date，禁止 `new Date("YYYY-MM-DD")`（UTC 解析陷阱）；`parseTimeStr` 容错 "9:5"→"09:05"。
- 周表图（`weeklyImage/`）：`WeeklyImageDialog` 打开时一次性拉全量计划，`weekUtils.ts` 自实现 ISO-8601 周算法；`layout.ts` 同日多场「 / 」拼单行、40px shrink-to-fit 至 22px 截断加「…」、行坐标常量与 `public/assets/original/AGENTS.md` 一致；日期区域坐标 `DATE_X=640`/`DATE_Y=80`/`DATE_WIDTH=451`/`DATE_HEIGHT=40`，日期指令 `dayIndex=-1` 标记非按天指令，**仅当 `dateConfig.enabled === true` 时才产出日期指令**，`fitToWidth` 参数化下限 `DATECONFIG_MIN_FONT_SIZE=14` 支持日期区更小字号；`renderer.ts` Canvas 2× 离屏超采样（3330×2160）+ `imageSmoothingQuality: "high"` 缩回 1665×1080 输出 PNG dataURL。
- 周表图片自定义（`scheme.ts`/`storage.ts`）：`DefaultScheme`/`WeekScheme` 类型 + Zod schema（全局对齐/字号/颜色 + 7 天 `DaySettings` + 可选 `DateSchemeConfig`）；`DateSchemeConfig` 含 enabled（是否启用日期范围渲染，默认 false）、format（日期格式模板）、content（日期内容模板）、align/fontSize/color（独立于全局）；`createDefaultScheme()` 默认左对齐 40px #5b4b68；`createDefaultDateConfig()` 默认 enabled=false + `{yyyy}年{mm}月{dd}日` + `{开始日期} ~ {结束日期}`；`resolveEffectiveScheme(week, store)` 按周取方案、Zod 非法回退默认；`resolveDateConfig(scheme)` 返回日期配置（缺省回退 enabled=false + 默认格式/内容/字号 20/全局对齐与颜色）；`formatDate(dateStr, format)` 替换 `{yyyy}/{yy}/{mm}/{m}/{dd}/{d}` 变量；`buildDateContent(template, startStr, endStr)` 替换 `{开始日期}/{结束日期}`；`buildDaySchedulesText`/`resolveDayText` 变量求值；`ensureWeekScheme` 深拷贝附周归属。`storage.ts` localStorage 读写 + 内存 Map 兜底（隐私模式），`loadDefault`/`saveDefault`/`loadWeek`/`saveWeek`/`deleteWeek`/`hasWeek`。
- `WeeklyImageDialog` 扩展：状态 `scheme`/`editingDefault`，打开时按当前周加载有效方案；切换编辑默认方案模式时切换 scheme 来源；全局设置（对齐三选、字号 16-60、颜色色板+文本）+ 日期设置（启用日期范围勾选框默认不勾选、日期格式/内容模板、对齐沿用/左/中/右、字号 14-30 默认 20、颜色）+ 按天设置（七天折叠面板，每项内容模板 + 插入 `{schedules}` 按钮 + 覆盖对齐/字号/颜色）；任一变更自动保存（非编辑默认模式时 `ensureWeekScheme` + `saveWeek`，编辑默认模式时 `saveDefault`）；`useEffect` 依赖 `scheme` 引用变化驱动重绘。
- 输入框 `autoComplete="off"`：DatePicker/TimePicker 关闭浏览器自动填充联想。

## 首页一屏封面页（features/home + app/(site)/page.tsx）

- 首页 `app/(site)/page.tsx`：`relative flex h-svh flex-col overflow-hidden` **一屏不可滚动**的流式分区封面页——立绘作为 **absolute 衬底**（移动端 `inset-x-0 top-[10%] h-[90%]` 且 `Image ml-[25%]` 右移 25% 宽、桌面 `left-auto right-[10%] w-1/2` 不偏移），`Image` `object-cover object-top` 顶部锚定裁剪（不变形），`pointer-events-none` 不遮挡交互；左列内容（直播状态 + 今日日程组件 + 文案块）以 `flex flex-1 flex-col justify-end` 纵向流式排布，靠布局自然避让（不叠固定偏移魔法数）；Footer 以 `floating` 形态在页内底部渲染**通栏贴底毛玻璃条**（`w-full border-t + backdrop-blur`，免责声明全端展示）。
- `features/home/api.ts`：`getLiveStatus()`（复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径，未配置短路 `{ok:false, status:null}`，任何失败静默降级）。
- `features/home/LiveStatus.tsx`（Client）：`API_CONFIGURED` 守卫（未配置返回 null 不留占位）；固定尺寸骨架防 CLS；三态渲染——「直播中」（状态点 + `animate-pulse`）/「未开播」/降级中性态；整体 `<a href={site.links.live} target="_blank" rel="noopener noreferrer">` 点击跳直播间（liveUrl 由服务端 props 自 `site.links.live` 传入）。样式基于被移除的 ColorChip 药丸语言改造。
- `features/home/TodaySchedule.tsx`（Client）：`API_CONFIGURED` 守卫；`listPlans(today, today)`（本地时区当天，与日历页口径一致，不混入历史）；渲染「今日日程」标题 + 当天计划 `HH:mm 主题`；无计划/失败展示「今日暂无安排」空态；固定尺寸骨架。
- 已删除：`features/home/ColorChip.tsx`（应援色复制按钮）、`features/home/EntryCard.tsx`（入口卡）；`WeeklySchedule.tsx` 不再由首页挂载（保留文件但无引用）。
- 内容 `content/profile.yaml` 扩展字段：`bookAnimeTypes`（书籍/动漫类型）、`musicTypes`（音乐类型）、`gameGenre`（游戏偏好类型），`/about` 喜好区块同步展示。

## 录播（features/recordings）

纯前端模块，直连外部录播服务（无 `servers/api`/契约变更）。基址按环境分派：生产静态导出用构建期 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 绝对公网地址（`deploy.yml` 注入，线上 CDN 已为站点源配置跨域，浏览器直连）；本地开发用同源前缀 `/recordings-proxy`，由 `next.config.ts` 的 dev `rewrites()` 转发到 `NEXT_PUBLIC_RECORDINGS_BASE_URL`（缺省回退内网地址，可用同名 host 环境变量覆盖）以规避跨域——`rewrites` 仅在 `NODE_ENV === "development"` 挂载，与 `output: "export"` 生产构建不冲突。`RECORDINGS_CONFIGURED` 以构建期环境变量是否非空为准（门控语义与生产一致，未配置形态渲染空态、导航无入口）；请求不带凭据（公开只读独立基址，不复用后台 `request()`），相对基址下 `joinUrl`/下载/FLV 地址均为同源相对路径。

- `api.ts`：导出 `RECORDINGS_BASE_URL`/`RECORDINGS_CONFIGURED` 与类型 `RecordingStatusItem`/`RecordingFile`；`joinUrl(base,path)` 归一拼接（单斜杠）、`liveAudioUrl(roomId)`、`recordingFileUrl(roomId,fileName)`（`encodeURIComponent`）；`getRecordingStatus()`（`{ok,items}`，归一化 `streamer.name→streamerName`、未知 `state→not_live`、缺 `sessionTitle→null`）、`getRoomRecordings(roomId)`（`{ok,files}`，过滤非法项）；未配置或非 200/非法 JSON/fetch 失败均静默降级 `{ok:false,...}`。
- `useRecordingStatus.ts`：首拉 + 30s 轮询 + `visibilitychange` 暂停/恢复即刷；未配置时不发请求。
- `player.ts`：全局单例播放器，mpegts.js 经浏览器端**动态 `import`**（避免 SSG 期求值 `self` 导致构建失败）；记录当前播放归属 `currentUrl` 并对外暴露 `subscribePlayer`/`getPlayingUrl`（`useSyncExternalStore` 供组件校正播放态）；`destroyPlayer(url?)` 传入 url 时**仅当当前播放归属匹配才销毁**（组件卸载清理不误断他路播放）；`play(url,videoEl,{isLive,onError})` 前先销毁旧实例、以代次号丢弃加载期被取代的实例；`pausePlayer`/`resumePlayer`/`isPlaybackSupported`。
- 组件：`RecordingsApp`（页主体，装配状态列表 + 录播列表，持有展开文件 state `openFile: {roomId,file} | null`——同一时间只允许一个展开的播放器，点击另一文件项即替换并触发旧播放器折叠销毁）、`RecordingStatusList`（F2/F3 展示层 + 听直播按钮）、`LiveAudioButton`（单例音频流，录制中房间渲染；播放归属由全局单例维护，他处接管自动复位）、`RoomRecordingsGroup`（F4 折叠展开 + 按需拉取一次 + `createdAt` 倒序 + 20/页前端分页 + 分组内错误重试且重试重置页码；`FlvPlayerPanel` 内联渲染于被点击文件项自身下方，手风琴式展开/折叠）、`FlvPlayerPanel`（F5 视频播放：**可见 `<video>` 画面区**（不得 hidden），控制条含**可拖动进度条**（`input[type=range]` 绑定 `currentTime`/`duration`，拖拽写回 `video.currentTime` 触发 mpegts seek——依赖上游 Range 支持，实现期复验；上游不支持则禁用拖动并明示）、播放/暂停、音量、当前时间/总时长；`isPlaybackSupported()` 降级 + 原生下载；被其它流接管时复位为可重播）、`RecordingsEmpty`、`format.ts`（`formatFileSize`/`formatCreatedAt`）。
- `app/(site)/(content)/recordings/page.tsx`：服务端壳，`metadata` + `RECORDINGS_CONFIGURED` 守卫（未配置渲染 `RecordingsEmpty reason="unconfigured"`，对齐 `/calendar` 的构建时守卫模式）。
- 依赖：`mpegts.js`（唯一新增运行时依赖）。

## 弹幕前端（features/danmaku）

- 类型：`LiveEventSchema` 与 `contract/live-events.openapi.yaml` 逐字段一致；金额口径 SC 直接元、礼物 `combo_total_coin/1000`、上船 `price/1000`。
- `useOnlineCount.ts`：直播间在线人数 hook；直接解析 `useLiveEventStream` 透出的 `online_rank_count` 命名帧信封，取 `payload.online_count` 经 5s 节流（leading+trailing，作用于数值更新、不产生额外请求）更新；挂载时 `GET /api/live-events?type=online_rank_count&page=1&pageSize=1` 首取仅作首屏兜底（至多 1 次，空则等首帧）；`API_CONFIGURED === false` 恒返回 null；不持有 EventSource，卸载零请求。
- `components/OnlineCountText.tsx`：`{ onlineCount: number | null }` 入参，null 返回 null，否则渲染 `<span className="text-sm font-normal text-ink-dim">当前直播间在线 {onlineCount} 人</span>`。
- `useLiveEventStream.ts`：EventSource `/api/live-events/stream?type=…`（withCredentials），全页面唯一一条 SSE 连接（弹幕看板订阅类型由页面装配层追加 `online_rank_count`，不入栏位类型系统）；无名帧 eventId 内存 Set 去重（应对首屏重叠与重连重推）；非法帧静默忽略；`addEventListener("online_rank_count", …)` 命名帧解析上游原始信封经独立回调透出（不走归一化与去重）；状态机 idle/connecting/open/closed；类型组合变更用 derive-state 模式重建连接。
- 栏位（`columns.ts`）：localStorage `danmaku-backdoor.columns`，Zod 校验、损坏回退默认 3 栏（礼物+上船混排 | SC | 弹幕）；2 栏预设为上船+SC混排 | 弹幕+礼物混排；`useSyncExternalStore` 快照 + storage 事件跨标签页同步，SSR 快照恒默认；视口夹取（narrow <640 单栏 / medium ≤2 栏 / wide 2–3 栏）用 `COLUMN_PRESETS` 覆盖且不回写存储。
- `GiftItem` 按契约可选 `gift.iconUrl` 懒加载固定尺寸图标，加载失败隐藏；`GuardItem` 按等级复用本地徽章素材并提升船型 chip 字号。
- 每「栏×类型」独立分节检索/分页/错误重试，generation ref 防竞态；滚动近底 200px 自动加载（短列表不自动加载防循环，折叠后未铺满例外向下补一条）。
- `useAnchoredFeed.ts`：prepend 致 scrollHeight 增长时，离顶 >8px 按差值补偿 scrollTop 并计入挂账；其后新行实测回填使总高回缩时，在挂账额度内回退多补部分（净补偿=新行实测高度）；无挂账的回缩不调整；>200px 显示「回到顶部」。
- 折叠（`merge.ts`）：仅 danmaku；表情以 emote url 为键、文字以最长非重复子串为键；锚定末次出现原位累计计数；混排栏 `mergeEventsByTime` 按 occurredAt 倒序、eventId 稳定决胜。合并开关（`mergeEnabled.ts`）：localStorage `danmaku-backdoor.merge-danmaku`（JSON boolean，无 Zod——typeof 校验），损坏回退 false（默认关闭）；`DanmakuDashboard` 以 `useState(() => loadMergeEnabled())` 初始化，含弹幕类型的栏头工具区渲染 `role="switch"` 开关切换即时生效不重新检索；`FeedSection` 关闭时逐条映射 `{event, count: 1}`、`folded` 恒 false 不触发折叠自动填充。
- 虚拟化 `@tanstack/react-virtual`（estimateSize 72）；已读双击切换为乐观更新、失败回滚 + toast。
- 插入/平移动效：`DanmakuDashboard.handleStreamEvent`（SSE 唯一入口）对实际插入的 eventId 记入 `freshIds`（单计时器 300ms 批量清除，ref 持有避免闭包陈旧；低价 gift 丢弃/去重跳过不标记），经 FeedColumn 透传；`FeedSection` 虚拟行 wrapper 在贴顶跟随且非滚动中时挂 `transition-transform duration-50` 实现平移过渡（`virtualizer.isScrolling` 或离顶时 `transition-none`——离顶 prepend 由锚定补偿瞬时保持内容，过渡叠加会闪回），fresh 行内层挂 `animate-danmaku-enter`（动画类在被 measureElement 测量的节点内层；`--animate-danmaku-enter` 50ms ease-out，keyframes 仅 transform/opacity）；reduced-motion 不做全局时长覆盖；公开站氛围层（首页雾气 fog、藤蔓生长 vine-draw、视差、粒子、翻页转场与冲量）不降级，仅后台弹幕看板功能性定位闪光 `.animate-danmaku-flash` 在 `prefers-reduced-motion: reduce` 下关闭。
- `SuperChatItem` 容器无 `select-none`，留言气泡 `select-text cursor-text` + dblclick 隔离（stopPropagation），选中复制与双击已读互不干扰。
- `DanmakuItem` 按 `sender.guardLevel` 经 `guardDanmakuTint`（`format.ts`，3/2/1→eye/flower/crimson 10% 透明度，其余 null）渲染淡色背景。
- 礼物金额筛选（`giftMinPrice.ts` + `GiftFilterControl.tsx`）：localStorage `danmaku-backdoor.gift-min-price`（JSON number），Zod `z.coerce.number().finite()` 校验 + 夹取 [0,100] + 四舍五入到 0.1 步进，损坏回退 0；按钮 + 弹层（滑动条+输入框双向同步，防抖 300ms 提交，blur/Enter 立即提交）；阈值变化仅重载礼物分节（页码重置），SSE 低价礼物前端丢弃；礼物请求捕获阈值、响应比对丢弃（作用域收窄到 gift，不递增全局 generationRef）。
- SC 隐藏钢镚（`hideLowSc.ts`）：localStorage `danmaku-backdoor.hide-low-sc`（JSON boolean），typeof 校验，损坏回退 false（默认关闭）；复用 `columns.ts` 的 `useSyncExternalStore` + storage 事件口径实现跨组件同步（页头 `MarkReadButtonGroup` 写入 → `DanmakuDashboard` 读取过滤）；`isScHidden(price)` 纯函数：`price !== undefined && price < 30`。`DanmakuDashboard` 持有 `hideLowSc` state + ref，展示过滤统一在 `visibleEventsBySection` 派生层（对 super_chat 节 `filter(!isScHidden(price))`），原始 `eventsBySection` 不变保去重/分页；实时 `handleStreamEvent` 中低价 SC 丢弃（不插入、不清 New、不标入场）。
- 标记已读按钮组（`MarkReadButtonGroup.tsx`）：admin+ 渲染上船/SC 全部已读（复用 3s 二次确认）+ 隐藏钢镚开关（role=switch）；member 仅渲染隐藏钢镚。空间不足折叠：`useMediaQuery("(max-width: 639px)")` 窄视口恒折叠，宽视口按容器 `offsetWidth` 与所需宽度（按钮数 × 120px）判定；折叠态渲染单个「标记已读」触发钮（aria-expanded），点击展开 dropdown 菜单含各项操作，点击外部/Esc 收起。`DanmakuDashboardHandle` 扩展 `readAll(type)` 方法，页头通过 `dashboardRef` 调用。
- FeedColumn 移除栏头全部已读：去掉 `readAllTypes`/`onReadAll` 入参、`READ_ALL_LABELS`、`confirming` 状态与栏头全部已读按钮渲染；二次确认逻辑上收至 `MarkReadButtonGroup`。

## 弹幕检索（features/danmaku/search）

- `search/api.ts`：`searchLiveEvents(criteria, page, pageSize, signal?)` 复用 `request()`（支持 AbortSignal 透传），返回 `LiveEventsPage` 口径。
- `search/highlight.ts`：纯函数 `splitByKeyword(content, keyword)` 使用 `indexOf` 循环朴素子串切分（规避正则元字符），连续命中合并；`formatOccurredAt(iso)` 输出 `MM/DD HH:mm` 本地化短格式（danmaku 域本期新增口径）。
- `search/useDanmakuSearch.ts`：状态 `{input, criteria, results, total, page, status, loadingMore, error, failedPage}`；输入变化防抖 300ms → criteria 触发搜索；回车 flush 立即搜索；每次请求新建 AbortController、effect 清理 abort（竞态以 abort 为准）；非追加搜索（首搜/切换关键词）起始时重置 results/total/page（loading 态显示「搜索中…」，失败时落入整页错误态，不残留旧关键词结果）；追加失败保留已有结果、清 loadingMore、记录 failedPage 供页内重试；`loadMore` append + 防重复；`results.length >= total` 隐藏「加载更多」。
- `search/components/`：
  - `SearchBox.tsx`：全宽输入框 + 搜索图标 + 清除按钮，`aria-label="弹幕检索关键词"`，`maxLength={200}`。
  - `SearchResultCard.tsx`：按 `event.type` 分发渲染——`danmaku` 走 `DanmakuCard`（复用 `Sender` compact + `splitByKeyword` 命中段包 `<mark>` bg-eye/30 + emote 渲染 + `formatOccurredAt`）、`super_chat` 走 `SuperChatItem` 传入 `highlightKeyword`、`gift` 走 `GiftItem`、`guard_buy` 走 `GuardItem`；容器响应式宽度（sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]）。
  - `SuperChatItem`（复用看板组件）：新增可选 `highlightKeyword` 入参，非空时留言命中子串以 `<mark>` bg-eye/30 高亮；罗马音行不高亮；缺省时输出与现态一致。
  - `SearchResults.tsx`：容器 `flex flex-wrap gap-3`，三态（加载中/无匹配/错误+重试）+ 总数 + 末尾「加载更多」。
- 页面：`app/backdoor/(dashboard)/danmaku/search/page.tsx`（`"use client"`：页头 + 返回看板 Link + SearchBox + SearchResults）。
- SideNav `NAV_ITEMS` 已注册「弹幕检索」为一级导航项（全角色可见），选中态通过最长前缀匹配（`pathname.startsWith(href)` + href 长度降序）判定。
- 只读口径：检索页不挂载已读交互，不调用 `markLiveEventRead` 等写接口。
- `features/backdoor/api.ts` 的 `request()` 扩展 `signal` 选项（`fetch({ signal })`），保持既有调用零影响。

## 弹幕工具（features/danmaku-tools）

纯前端模块，契约/服务端/编排零变更。

### 数据模型（vote/types.ts）

- `voteOptionSchema`：`{ id: string, name: string, keyword: string, count: number }`，id 由 `crypto.randomUUID()` 生成。
- `voteStateSchema`：`{ options: VoteOption[], processed: number, matched: number, voterUids: number[] }`，sender.uid 为 number。
- `EMPTY_VOTE_STATE`：全零空态常量。

### 匹配纯函数（vote/match.ts）

- `matchVote(content, options)`：恰好单命中返回选项 id，0 或 ≥2 返回 null（≥2 为互斥兜底）。
- `hasKeywordConflict(keyword, existing)`：双向子串判定 `existing.some(o => o.keyword.includes(keyword) || keyword.includes(o.keyword))`。

### 持久化（vote/store.ts）

- key 常量 `VOTE_STORAGE_KEY = "danmaku-tools.vote"`；`getStorage()` SSR 守卫。
- `loadVoteState()`：JSON.parse + voteStateSchema.safeParse，任一失败回退 `EMPTY_VOTE_STATE` 拷贝。
- `saveVoteState(state)`：JSON.stringify 写入；存储不可用时静默跳过。
- `clearVoteState()`：removeItem。

### 投票状态机 hook（vote/useDanmakuVote.ts）

- 状态：`state: VoteState` + `voting: boolean` + `hint: string | null` + `hydrated: boolean`。
- 挂载后经 `useEffect(() => setState(loadVoteState()), [])` 恢复持久化数据（避免 hydration 不一致）；`hydrated` 标记防止初始空态覆盖已有持久化数据。
- `voterSetRef`：`useRef(new Set<number>())` 随 `state.voterUids` 重建；事件回调中经 ref 查改，杜绝闭包旧值。
- `optionsRef`：`useRef<VoteOption[]>` 随 `state.options` 同步，供 EventSource 回调读最新选项。
- 持久化 effect：`hydrated` 为 true 时 `saveVoteState(state)` 回写。
- `addOption(name, keyword)`：trim 后校验空值 + `hasKeywordConflict`；voting 中拒绝（双保险）。
- `removeOption(id)`：voting 中拒绝；删除已计票选项时 matched 保持原值。
- `start()`：空选项拒绝；`new EventSource(...)` withCredentials；`es.onmessage` 解析 LiveEventSchema，type !== "danmaku" 忽略；content === undefined 跳过匹配；`matchVote` 命中且 uid 未投票则计票。
- `stop()`：`es.close()`，统计保留。
- `clear()`：先 stop，再重置 EMPTY_VOTE_STATE + clearVoteState()。
- 卸载清理：`useEffect` return 中 `es.close()`。

### 渲染组件

- `ToolCard.tsx`：名称 + 简介，整卡 Link 包裹跳转；卡片样式沿用 `bg-raised/border-vine`。
- `VoteOptionsEditor.tsx`：选项列表行（名称 + 关键字 + 删除按钮）+ 新增表单 + hint 提示区（`role="alert"`）；voting 中全部 disabled。
- `VoteControlBar.tsx`：「开始投票/停止投票」双态按钮——开始态 `bg-primary`，停止态 `bg-crimson`（本期确立警示色用法）；旁置「清空投票」次按钮。
- `VoteStatsTable.tsx`：统计文案 + 语义化 `<table>`（`<caption>` + aria-label）；占比 = count/总票数，总票数为 0 显示 0%。
- `ClearVoteDialog.tsx`：仿 GiftCardDialog 模式——`fixed inset-0 z-50` 遮罩、`role="dialog" aria-modal`、Esc 关闭、点击遮罩取消、body 锁滚动、打开后焦点落于「取消」按钮；「确认清空」按钮用 `crimson`。

### 页面

- `app/backdoor/(dashboard)/danmaku-tools/page.tsx`：工具列表页，Server Component；卡片栅格 `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`。
- `app/backdoor/(dashboard)/danmaku-tools/vote/page.tsx`：`"use client"`；`useDanmakuVote()` 下传分区渲染；`lg:grid-cols-2` 左右两栏；ClearVoteDialog 由页面持有 open 状态。

### 导航

- SideNav `NAV_ITEMS` 追加 `{ href: "/backdoor/danmaku-tools", label: "弹幕工具", roles: ["superadmin", "admin", "member"] }`；选中态最长前缀匹配，`/backdoor/danmaku-tools/vote` 命中「弹幕工具」而非「弹幕看板」。

## 棉花糖（features/topics）

### 模块结构

| 文件 | 职责 |
|------|------|
| `features/topics/types.ts` | Zod schema（Topic / Marshmallow / TopicPublicInfo） |
| `features/topics/api.ts` | 管理端点 + 公开端点封装 |
| `features/topics/status.ts` | 状态文案/徽标色纯函数 |
| `features/topics/clientKey.ts` | localStorage 客户端标识读写 |
| `features/markdown/MarkdownEditor.tsx` | @uiw/react-md-editor 封装（`next/dynamic ssr:false`） |
| `features/markdown/MarkdownView.tsx` | react-markdown + remark-gfm（禁原始 HTML） |

### 组件

| 组件 | 说明 |
|------|------|
| `TopicCard` | 列表页卡片（标题/状态徽标/三按钮） |
| `TopicFormDialog` | 新建/修改主题弹窗（含 MarkdownEditor） |
| `CollapsibleMarkdown` | 可折叠 Markdown（line-clamp-3） |
| `MarshmallowCard` | 棉花糖条目（内容默认折叠 5 行，超限底部渐变层「点击查看全文」开 `MarshmallowDetailDialog`）+ 采用切换 + AI 覆盖层三态（不透明实色覆盖） |
| `MarshmallowDetailDialog` | 棉花糖全文弹窗（`max-h-[75vh]` 内部滚动，内含采用/取消采用按钮） |
| `ConfirmDialog` | 投递前 AI 审核告知弹窗 |
| `SubmitDoneView` | 提交完成结果视图（成功提示 + 「查看进行中的棉花糖」链接 → `/topics`） |
| `TopicPublicPage` | 公开收集页主体 |
| `TopicsOngoingPage` | 公开「进行中的棉花糖」列表页主体（`/topics` 无 `id` 查询串时渲染） |
| `ShareTopicDialog` | 分享投递链接 + 二维码（`qrcode` 客户端生成 dataURL，下载文件名 `投递二维码-{sanitize(主题)}.png`） |
| `sanitizeFilename` | 二维码下载文件名 sanitize 纯函数 |
| `toSingleLinePlainText` | Markdown→单行纯文本工具（去除标题/列表/链接/粗体等标记、换行折叠为空格） |

### 后台页面

- **列表页**（`/backdoor/topics`）：RequireRole("admin") 守卫，页头视图切换「主题 / 已归档主题」，卡片栅格，编辑弹窗；已归档视图卡片仅「恢复」（confirm → POST restore）与进详情
- **详情页**（`/backdoor/topics/detail?id={topicId}`）：RequireRole("admin") 守卫，折叠描述，棉花糖列表（条目默认折叠 5 行，超限渐变层「点击查看全文」开全文弹窗，弹窗 `max-h-[75vh]` 内部滚动且含采用按钮；AI 覆盖层不透明），工具栏含「分享」（ShareTopicDialog 浮层：投递链接复制 + 二维码展示/下载）。查询串方案（GitHub Pages 静态导出兼容动态路由），id 经客户端 `useSearchParams` 读取并包 Suspense。**已归档主题只读**：工具栏仅保留「分享」「幻灯片」，棉花糖卡片与全文弹窗不渲染采用按钮，AI 覆盖层不渲染「显示这条棉花糖」
- **幻灯片页**（`/backdoor/topics/presentation?id={topicId}`）：查询串方案，独立页，RequireRole("admin") 守卫，分页拉取所有棉花糖；**单行页头**（左标题衬线+单行纯文本描述 max-w-25% 省略，右「字体」label+字号预设档位 小/中/大），页头与放映区 `border-t border-vine` 分割，条目 `max-w-[50%]` 居中文本左对齐

### 公开收集页

- 查询串方案（`/topics?id={topicId}`），GitHub Pages 静态导出兼容；id 经客户端 `useSearchParams` 读取并包 Suspense
- 三态视图：form / submitting / done
- done 态展示成功提示 + 「查看进行中的棉花糖」链接（→ `/topics`），不含审核字段，无「再投一条」

### 公开「进行中的棉花糖」页

- 同 `/topics` 路由：无 `id` 查询串时渲染 `TopicsOngoingPage` 进行中列表（`GET /api/topics/public`，无需鉴权）
- 列表项卡片：标题 + 描述截断 + 起止时间，整卡 Link → `/topics?id={topicId}`；空态「暂无进行中的棉花糖」
- NavBar 追加「棉花糖」入口（独立路由链接 `/topics`，不走首页 deck 锚点翻页，选中态 `pathname === "/topics"`，移动端折叠菜单同步；仅 `API_CONFIGURED` 时显示，照「日历」过滤口径）；「录播」入口（独立路由 `/recordings`，选中态 `pathname === "/recordings"`，位置在「棉花糖」同组、工具项之前；仅 `RECORDINGS_CONFIGURED` 时显示）；NavBar 保持 `fixed inset-x-0 top-0`，不随页面滑动；**导航不再包含外链项**——原「小密室」外链（`https://sumire.icu`）迁至 Footer 外链区（数据源 `site.links.secretRoom`），`NavBar` 的 `EXTERNAL_LINKS`/`ExternalLink`/`isExternal` 与外链渲染分支已移除，链接模型回归纯站内 `BaseLink`（`navKey`/`label`/`anchor`/`route`/`sectionId`/`kind:"internal"`）。

SideNav `NAV_ITEMS` 追加 `{ href: "/backdoor/topics", label: "棉花糖", roles: ["superadmin", "admin"] }`。

## 悬停胶囊栏（features/danmaku）

### 纯函数与 Hook

- `hoverTopBar.ts`：悬停胶囊栏纯函数——`isHoverable(event)` 仅 `super_chat`/`guard_buy` 为 true；`pillPrice(event)` 取 `event.price`，缺失返回 0；`hoverDuration(event)` SC 取 `event.time`（>0 才取，缺失/非法/非正回退 `SC_DEFAULT_SECONDS=60`），上船按 `sender.guardLevel`（3→60s，2→300s，1→3600s，缺/未知→60s）；`pillKind(event)` SC→"sc"，其余→"guard"；`pillSort(a,b)` 金额降序，金额相同 arrivedAt 降序（新者优先）。
- `useHoverPills.ts`：胶囊集合 hook——`pills` state + 单一 `setInterval(500ms)` 统一扫描过期；`add(event)` 以 `eventId` 为 key 覆盖；`expiresAt` 从事件 `occurredAt` 起算（`occurredAtMs + duration*1000`），已流逝部分扣除，过期即跳过不加入；`types` 变化/卸载清理 interval；输出按 `pillSort` 排序。

### 组件

- `Sender.tsx`：公共发送者组件支持 `variant` 属性——`"full"`（默认）：头像+昵称+粉丝牌+船型标签；`"avatar-name"`：仅头像+昵称；`"avatar"`：仅头像，适用于悬停胶囊等紧凑场景。
- `HoverTopBar.tsx`：悬停胶囊栏组件——`{ pills: HoverPill[]; onLocate: (eventId: string) => void }` 入参；`pills.length === 0` 返回 null（不占位）；容器 `h-12`（48px）铺满、`flex items-center gap-2 overflow-x-auto px-3 py-1.5`；SC 胶囊用 `scColors` 渐变底色 + 字体色，内容 Sender variant="avatar" compact + 「醒目留言」+ `formatPrice`；上船胶囊用 `guardLevelTone(level)` 的 chip/text token + Sender variant="avatar" compact + `guardLevelName(level)` 文本；每个胶囊 `role="button"` + `aria-label` + `cursor-pointer` + `transition-colors duration-150`，点击触发 `onLocate(pill.eventId)` 弹出 GiftCardDialog 浮层。
- `GiftCardDialog.tsx`：礼物卡片浮层组件——模态对话框，居中展示，半透明遮罩背景，圆角边框，阴影效果；展示发送者头像、昵称、粉丝牌、事件类型（SC/上船）、金额/价格、留言内容（如有）、发生时间等完整信息；SC 卡片使用 `scColors` 渐变配色，上船卡片使用 `guardLevelTone` 船型强调色；可通过点击关闭按钮、点击遮罩层或按 Esc 键关闭。

### GiftCardDialog 浮层

- `GiftCardDialog` 为模态对话框组件，点击胶囊后弹出展示事件详情卡片。
- 卡片内容：发送者头像、昵称、粉丝牌、事件类型（SC/上船）、金额/价格、留言内容（如有）、发生时间等完整信息。
- SC 卡片使用 `scColors` 渐变配色，上船卡片使用 `guardLevelTone` 船型强调色。
- 交互：可通过点击关闭按钮、点击遮罩层或按 Esc 键关闭；打开时阻止背景滚动；关闭后焦点回到触发胶囊（无障碍访问）。

### DanmakuDashboard 接线

- `hoverTypes`：从 `columns.flatMap(c => c.types)` 过滤 `super_chat`/`guard_buy`，传入 `useHoverPills(hoverTypes)`。
- `handleStreamEvent`：SSE 到达 `isHoverable(event)` 时调用 `addPill(event)`。
- 历史检索入胶囊：`loadSection` 和 `loadMoreSection`/`loadMoreSectionMerged` 在成功加载后，遍历返回的 `items`，对 `isHoverable(event)` 的事件调用 `addPill(event)`。
- 混排栏合并请求：`loadMoreSectionMerged(col)` 按栏合并多 type 一次请求（`listLiveEvents(col.types, page, size)`），避免逐类多次请求；单类型栏仍用 `loadMoreSection(col, type)` 逐 type 请求。
- 混排栏分页口径：`mergedTotalByColumn`/`mergedPageByColumn` 独立存储混排栏的 total 和页码，不污染单类型的 `totalsBySection`/`pagesBySection`；hasMore 用「合并已加载条数 < 合并 total」判定；首屏加载完成后通过 `useEffect` 初始化 `mergedTotalByColumn`（各类型 total 之和）。
- `handleLocate(eventId)`：根据 `eventId` 在 `eventsBySection` 中查找目标事件，找到后触发 `GiftCardDialog` 打开并传入事件数据。
- `FeedColumn` 接收 `hoverPills`、`onLocate`、`sectionRefs` props，悬停胶囊栏挂载于栏头与 `sections.map` 之间。
