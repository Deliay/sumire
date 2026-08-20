# 前端架构 Spec（apps/bookstore）

Next.js 15 App Router，`output: "export"` 全静态导出（部署 GitHub Pages），TypeScript strict。

## 构建与配置

- `next.config.ts`：`basePath` 由 `NEXT_PUBLIC_BASE_PATH` 注入；`images.unoptimized`（缩略图构建期预生成）。
- 根布局加载三套 Google Fonts（Noto Serif SC / Noto Sans SC / Cormorant Garamond），metadata 模板 `%s · 堇色书屋`。
- **API 配置口径**：`API_CONFIGURED = NEXT_PUBLIC_API_BASE_URL !== ""`（`features/backdoor/api.ts`）是全局唯一判定，控制三处：`/calendar` 路由存在性、NavBar「日历」入口、首页「本周日程」区块。
- 未配置时双保险：`app/backdoor/layout.tsx` 直接渲染站点 404（不挂载 SessionProvider、不发请求），且 `api.ts` 的 `request()` 短路返回 `{status:0}` 不 fetch——杜绝静态站向主站自身发 `/api/*`。
- `app/globals.css` 的 `@theme` 中定义 `--animate-pulse: pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite`，覆盖 Tailwind v4 内置 2s 周期，全站 4 处骨架统一降速；`prefers-reduced-motion` 兜底不变。

## 路由结构

- `app/(site)/`：公开页路由组（`/`、`/about`、`/assets`、`/calendar`），共享布局 NavBar + main + Footer。
- `app/backdoor/`：后台路由区——`login`、`change-password`（独立卡片，无后台布局）、`(dashboard)/`（布局 = TopBar + SideNav + 内容区；子页 `page`、`users`、`schedule`、`danmaku`）。
- `app/not-found.tsx` 复用 `components/NotFoundPage.tsx`。

## 鉴权（纯客户端）

SSG 无 middleware/服务端守卫，所有守卫是体验层；安全依赖 API 侧独立鉴权。

- `SessionProvider`（`features/backdoor/session.tsx`）：状态机 `loading → authenticated | unauthenticated`；未登录访问受保护页 `router.replace` 到登录页；`mustChangePassword` 为真强制重定向改密页（login/change-password 两路径豁免防循环）。
- `RequireRole`：页面级角色守卫，权限不足跳 `/backdoor`；守卫期间渲染 `GuardLoading`，不闪内容。
- `roleAccess.ts`：层级 `superadmin(2) > admin(1) > member(0)`；`creatableRoles()`：超管可建任意、admin 仅 member。
- 所有 API 调用 `credentials: "include"`。

## 内容管道

- `content/{site,profile,assets}.yaml` + `lib/content/`：`readFileSync` + YAML + Zod 校验（`schemas.ts`：颜色 `#xxxxxx`、日期 `YYYY-MM-DD`、素材 id `[a-z0-9-]+`）+ React `cache`，构建期读取。
- 素材 URL：`{BASE_PATH}/assets/thumbnails/{id}.webp` / `{BASE_PATH}/assets/original/{file}`；缩略图由 `scripts/generate-thumbnails.ts`（sharp，最长边 1000px、q82 webp、保透明）从 `content/assets.yaml` 驱动生成。
- `lib/tools/registry.ts` 工具注册表当前为空（无 /tools 路由，未上线功能无占位入口）。

## 日历与计划（features/schedule）

- `CalendarView` 为公开页与后台共用组件：周一开头 6×7 月网格；<640px 切周视图（单周 7 天 + 周切换 + 回到今天）。`onRangeChange` 触发父级按区间重拉计划；历史仅首载拉一次全量。
- 月视图周表头与 42 格拆为两个并列网格，格子网格 `grid-rows-6` 六行 `1fr` 等高，`DayCell` 含 `h-full min-h-16 overflow-hidden`。
- `mergeEntries.ts`：plan/history 归一化为 `CalendarEntry`；历史按 startDate **本地时区**归开播当日；缺 title/startDate 丢弃、未来历史剔除；按 date+startTime 升序混排、不去重。
- `dateUtils.ts`：一律本地时区构造 Date，禁止 `new Date("YYYY-MM-DD")`（UTC 解析陷阱）；`parseTimeStr` 容错 "9:5"→"09:05"。
- 首页 `WeeklySchedule`（features/home）：客户端组件，本周一~周日 `listPlans(from,to)`，仅计划不合并历史。
- 周表图（`weeklyImage/`）：`WeeklyImageDialog` 打开时一次性拉全量计划，`weekUtils.ts` 自实现 ISO-8601 周算法；`layout.ts` 同日多场「 / 」拼单行、40px shrink-to-fit 至 22px 截断加「…」、行坐标常量与 `public/assets/original/AGENTS.md` 一致；`renderer.ts` Canvas 2× 离屏超采样（3330×2160）+ `imageSmoothingQuality: "high"` 缩回 1665×1080 输出 PNG dataURL。
- 输入框 `autoComplete="off"`：DatePicker/TimePicker 关闭浏览器自动填充联想。

## 弹幕前端（features/danmaku）

- 类型：`LiveEventSchema` 与 `contract/live-events.openapi.yaml` 逐字段一致；金额口径 SC 直接元、礼物 `combo_total_coin/1000`、上船 `price/1000`。
- `useLiveEventStream.ts`：EventSource `/api/live-events/stream?type=…`（withCredentials）；eventId 内存 Set 去重（应对首屏重叠与重连重推）；非法帧静默忽略；状态机 idle/connecting/open/closed；类型组合变更用 derive-state 模式重建连接。
- 栏位（`columns.ts`）：localStorage `danmaku-backdoor.columns`，Zod 校验、损坏回退默认 3 栏（礼物 | 上船+SC 分节 | 弹幕）；2 栏预设为上船+SC 分节 | 礼物+弹幕混排；`useSyncExternalStore` 快照 + storage 事件跨标签页同步，SSR 快照恒默认；视口夹取（narrow <640 单栏 / medium ≤2 栏 / wide 2–3 栏）用 `COLUMN_PRESETS` 覆盖且不回写存储。
- `GiftItem` 按契约可选 `gift.iconUrl` 懒加载固定尺寸图标，加载失败隐藏；`GuardItem` 按等级复用本地徽章素材并提升船型 chip 字号。
- 每「栏×类型」独立分节检索/分页/错误重试，generation ref 防竞态；滚动近底 200px 自动加载（短列表不自动加载防循环，折叠后未铺满例外向下补一条）。
- `useAnchoredFeed.ts`：prepend 致 scrollHeight 增长时，离顶 >8px 按差值补偿 scrollTop 并计入挂账；其后新行实测回填使总高回缩时，在挂账额度内回退多补部分（净补偿=新行实测高度）；无挂账的回缩不调整；>200px 显示「回到顶部」。
- 折叠（`merge.ts`）：仅 danmaku；表情以 emote url 为键、文字以最长非重复子串为键；锚定末次出现原位累计计数；混排栏 `mergeEventsByTime` 按 occurredAt 倒序、eventId 稳定决胜。合并开关（`mergeEnabled.ts`）：localStorage `danmaku-backdoor.merge-danmaku`（JSON boolean，无 Zod——typeof 校验），损坏回退 false（默认关闭）；`DanmakuDashboard` 以 `useState(() => loadMergeEnabled())` 初始化，含弹幕类型的栏头工具区渲染 `role="switch"` 开关切换即时生效不重新检索；`FeedSection` 关闭时逐条映射 `{event, count: 1}`、`folded` 恒 false 不触发折叠自动填充。
- 虚拟化 `@tanstack/react-virtual`（estimateSize 72）；已读双击切换为乐观更新、失败回滚 + toast。
- 插入/平移动效：`DanmakuDashboard.handleStreamEvent`（SSE 唯一入口）对实际插入的 eventId 记入 `freshIds`（单计时器 300ms 批量清除，ref 持有避免闭包陈旧；低价 gift 丢弃/去重跳过不标记），经 FeedColumn 透传；`FeedSection` 虚拟行 wrapper 在贴顶跟随且非滚动中时挂 `transition-transform duration-50` 实现平移过渡（`virtualizer.isScrolling` 或离顶时 `transition-none`——离顶 prepend 由锚定补偿瞬时保持内容，过渡叠加会闪回），fresh 行内层挂 `animate-danmaku-enter`（动画类在被 measureElement 测量的节点内层；`--animate-danmaku-enter` 50ms ease-out，keyframes 仅 transform/opacity）；reduced-motion 不做全局时长覆盖，仅关闭氛围动效（fog/vine-draw）。
- `SuperChatItem` 容器无 `select-none`，留言气泡 `select-text cursor-text` + dblclick 隔离（stopPropagation），选中复制与双击已读互不干扰。
- `DanmakuItem` 按 `sender.guardLevel` 经 `guardDanmakuTint`（`format.ts`，3/2/1→eye/flower/crimson 10% 透明度，其余 null）渲染淡色背景。
- 礼物金额筛选（`giftMinPrice.ts` + `GiftFilterControl.tsx`）：localStorage `danmaku-backdoor.gift-min-price`（JSON number），Zod `z.coerce.number().finite()` 校验 + 夹取 [0,100] + 四舍五入到 0.1 步进，损坏回退 0；按钮 + 弹层（滑动条+输入框双向同步，防抖 300ms 提交，blur/Enter 立即提交）；阈值变化仅重载礼物分节（页码重置），SSE 低价礼物前端丢弃；礼物请求捕获阈值、响应比对丢弃（作用域收窄到 gift，不递增全局 generationRef）。

## 弹幕检索（features/danmaku/search）

- `search/api.ts`：`searchLiveEvents(criteria, page, pageSize, signal?)` 复用 `request()`（支持 AbortSignal 透传），返回 `LiveEventsPage` 口径。
- `search/highlight.ts`：纯函数 `splitByKeyword(content, keyword)` 使用 `indexOf` 循环朴素子串切分（规避正则元字符），连续命中合并；`formatOccurredAt(iso)` 输出 `MM/DD HH:mm` 本地化短格式（danmaku 域本期新增口径）。
- `search/useDanmakuSearch.ts`：状态 `{input, criteria, results, total, page, status, loadingMore, error}`；输入变化防抖 300ms → criteria 触发搜索；回车 flush 立即搜索；每次请求新建 AbortController、effect 清理 abort（竞态以 abort 为准）；`loadMore` append + 防重复；`results.length >= total` 隐藏「加载更多」。
- `search/components/`：
  - `SearchBox.tsx`：全宽输入框 + 搜索图标 + 清除按钮，`aria-label="弹幕检索关键词"`，`maxLength={200}`。
  - `SearchResultCard.tsx`：复用 `Sender`（compact）+ `splitByKeyword` 命中段包 `<mark>`（bg-eye/30）+ emote 渲染 + `formatOccurredAt` 时间。
  - `SearchResults.tsx`：容器 `flex flex-wrap gap-3`，卡片响应式宽度（sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]）；三态（加载中/无匹配/错误+重试）+ 总数 + 末尾「加载更多」。
- 页面：`app/backdoor/(dashboard)/danmaku/search/page.tsx`（`"use client"`：页头 + 返回看板 Link + SearchBox + SearchResults）；看板页头工具区新增「弹幕检索」Link。
- `features/backdoor/api.ts` 的 `request()` 扩展 `signal` 选项（`fetch({ signal })`），保持既有调用零影响。
