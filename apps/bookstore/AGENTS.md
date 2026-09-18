# apps/bookstore

枝堇Sumire 粉丝站前端——Next.js（App Router）全静态（SSG）+ 后台 `/backdoor` 路由区（客户端会话/权限守卫）。

开发前加载 `docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与 `docs/engineering/backend-rules.md`（后台页面依赖的 API 契约见 `contract/backdoor-auth.openapi.yaml`；直播计划契约见 `contract/stream-plans.openapi.yaml`）。

## 技术栈

- Next.js（App Router）+ React + TypeScript（strict），全部静态生成（SSG）
- Tailwind CSS v4，token 定义于 `app/globals.css` 的 `@theme`
- 内容：仓库内 YAML + Zod 校验（`lib/content/`）
- 测试：Vitest（单元）+ Playwright（E2E）

## 常用命令

```bash
pnpm dev          # 本地开发
pnpm build        # 生成缩略图 + 生产构建
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试
pnpm lint         # ESLint
```

## 目录

| 目录 | 职责 |
|------|------|
| `app/` | 路由与页面；`app/backdoor/` 为后台路由区 |
| `features/backdoor/` | 后台会话守卫、权限守卫、API 调用、后台组件 |
| `features/<模块>/` | 页面/工具业务组件 |
| `components/` | 设计系统组件 |
| `lib/` | 内容加载与工具（含 `useMediaQuery.ts` 断点 hook：`useSyncExternalStore` 封装 matchMedia，SSR 快照固定 false） |
| `content/` | 站点数据 YAML |
| `public/assets/` | 素材原图与缩略图 |
| `tests/` | 单元测试 |

## 后台 /backdoor 约定

- 保持 SSG，会话/权限守卫在客户端；`features/backdoor/session.tsx` 的 `SessionProvider` 负责会话守卫与强制改密引导，`RequireRole` 负责权限守卫；
- 构建时守卫：`app/backdoor/layout.tsx` 读取 `api.ts` 导出的 `API_CONFIGURED`（`NEXT_PUBLIC_API_BASE_URL` 非空即已配置），未配置时直接渲染 `components/NotFoundPage` 站点风格 404（`SessionProvider` 不进入组件树）；`api.ts` 的 `request()` 亦在未配置时短路不 `fetch`，双保险杜绝发往主站自身的 `/api/*` 请求；
- API 调用统一走 `features/backdoor/api.ts`，`fetch(..., { credentials: "include" })`，base URL 取 `NEXT_PUBLIC_API_BASE_URL`；
- 视觉严格按 `docs/design/03-backdoor-design.md`：仅用 `@theme` token 色，后台不使用氛围动效，控件过渡 ≤200ms 且尊重 `prefers-reduced-motion`；
- 不出现注册/找回密码入口，不出现未上线功能占位。

## 弹幕看板约定

- `features/danmaku/`：弹幕看板业务模块（契约单一事实源 `contract/live-events.openapi.yaml`，前端不感知 B 站原始 payload）——`types.ts`（`LiveEvent`/`LiveEventType`/`ColumnConfig` Zod schema，与契约逐字段一致；gift 可选 `iconUrl`）、`api.ts`（`listLiveEvents`/`markLiveEventRead`/`markLiveEventUnread`/`markAllLiveEventsRead`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径，未配置短路不 fetch）、`columns.ts`（栏位配置 localStorage `danmaku-backdoor.columns`，Zod 非法回退默认二期 3 栏「礼物 | 上船+SC 分节 | 弹幕」；含 `useSyncExternalStore` 快照口径 `getColumnsSnapshot`/`subscribeColumns`/`saveColumns`）、`mergeEnabled.ts`（弹幕合并开关 localStorage `danmaku-backdoor.merge-danmaku`，JSON boolean，损坏回退 false 默认关闭）、`useLiveEventStream.ts`（EventSource `withCredentials` 订阅 `/api/live-events/stream`——全页面唯一一条 SSE 连接，eventId 内存 Set 去重，`addEventListener("online_rank_count", …)` 命名帧解析上游信封经独立回调透出，返回连接状态）、`useOnlineCount.ts`（直播间在线人数 hook：直接解析透出的命名帧 `payload.online_count`，5s 节流作用于数值更新；首取 REST 仅作首屏兜底至多 1 次；不持有 EventSource；`API_CONFIGURED === false` 恒返回 null）、`useAnchoredFeed.ts`（prepend 滚动锚定纯函数 `computeAnchorScrollTop` + hook：离开顶部按 scrollHeight 差补偿、贴顶跟随、`scrollTop > 200` 回到顶部）、`format.ts`（`guardLevelName` 3/2/1→舰长/提督/总督、`formatPrice` 元、`labelForType`、`guardDanmakuTint` 3/2/1→eye/flower/crimson 10% 透明度背景类，其余 null）；
- 组件 `features/danmaku/components/`：`Sender`（头像+昵称+牌子按颜色，点击新开 `space.bilibili.com/{uid}`，缺头像兜底首字、无牌子不渲染）、`DanmakuItem`（含表情弹幕 `emote` 按原图宽高渲染图片；按发送者船型拼 `guardDanmakuTint` 淡色背景）/`SuperChatItem`（两行 + scColors 渐变 + 置灰；留言气泡 `select-text` 可选中复制，留言文字区干净单击触发已读、拖选不触发、B 站链接/头像昵称穿透不吞）/`GiftItem`（接线 `onToggleRead` 单击已读）/`GuardItem`（船型+金额+数量+置灰，单击已读）、`OnlineCountText`（直播间在线人数展示，`{ onlineCount: number | null }` 入参，null 时不渲染）、`FeedSection`（单类型虚拟化信息流小节：独立滚动 + prepend 锚定 + 回到顶部 + 滚动接近底部触发 `onLoadMore` 分页加载，`hasMore` 时尾部渲染「加载更多」按钮/`loadingMore` 时渲染「加载中…」；`mergeEnabled` 关闭时弹幕逐条渲染不折叠；虚拟行 wrapper 贴顶且非滚动中时 transform 平移过渡（50ms；滚动中/离顶时禁用，离顶 prepend 由锚定补偿瞬时接管防闪回），freshIds 命中的新行内层挂 `animate-danmaku-enter` 入场动画）、`FeedColumn`（`@tanstack/react-virtual` 虚拟化栏容器 + SC/上船/礼物「标记全部已读」二次确认 3s 超时复位；多类型栏位按类型上下分栏逐小节渲染，单类型整栏仅一小节；透传 `onLoadMore`/`hasMore`/`loadingMore`/`mergeEnabled`/`freshIds`）、`DanmakuDashboard`（默认 3 栏弹幕+礼物（上下分栏）|SC|上船，历史逐栏分页检索（首屏 page=1 + 滚动加载下一页 append 去重，按服务端 `total` 判定 hasMore）+ SSE prepend 分发，`<1024px` 纵向堆叠纯 CSS；栏头工具区「弹幕合并」开关（默认关闭，持久化 localStorage）；`handleStreamEvent` 对实际插入的 SSE 事件记 `freshIds`（300ms 单计时器批量清除）驱动入场动画；forwardRef 暴露 `replayTest` 供开发环境回放测试按钮调用）；
- 已读交互：SC/Gift/上船条目单击切换（乐观更新失败回滚 + toast），仅 admin 及以上传入 `onToggleRead`——member 不渲染已读交互，与后端 403 口径一致；SC 留言文字区干净单击触发已读、拖选（`getSelection` Range 非折叠）不触发、B 站链接/头像昵称穿透不吞；虚拟列表 `getItemKey` 用 `eventId`，测量跟随条目；
- 后台页 `app/backdoor/(dashboard)/danmaku/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；页面层 `useLiveEventStream` 订阅类型追加 `online_rank_count` 并传入透出回调，`useOnlineCount` 消费该回调（页面层调用一次），普通/全屏页头 `<h1>弹幕看板</h1>` 后尾随 `<OnlineCountText onlineCount={onlineCount} />`，两处共用同一份 hook 状态；全页面 `/api/live-events/stream` 仅一条连接。
- SideNav `NAV_ITEMS` 当前 6 项（仪表盘/直播计划/弹幕看板/弹幕检索/弹幕工具/用户管理），全角色可见项含前五项；选中态通过最长前缀匹配（`pathname.startsWith(item.href)` + `href.length` 降序）判定——`/backdoor/danmaku/search` 命中「弹幕检索」而非「弹幕看板」；`/backdoor/danmaku-tools/vote` 命中「弹幕工具」而非「弹幕看板」。
- 弹幕检索 `features/danmaku/search/`：`api.ts`（`searchLiveEvents`，复用 `request()` 支持 AbortSignal 透传）、`highlight.ts`（`splitByKeyword` 基于 `indexOf` 子串切分 + `formatOccurredAt` MM/DD HH:mm）、`useDanmakuSearch.ts`（300ms 防抖 + AbortController 取消 + loadMore append + 追加失败保留已有结果并记录 failedPage + 重试失败页）、`components/`（`SearchBox` 全宽输入框 + 搜索图标 + 清除按钮、`SearchResultCard` 按 `event.type` 分发渲染——`danmaku` 走 `DanmakuCard`（`Sender` compact + `splitByKeyword` 高亮 `<mark>` + emote 渲染 + `formatOccurredAt`）、`super_chat` 走 `SuperChatItem` 传入 `highlightKeyword`、`gift` 走 `GiftItem`、`guard_buy` 走 `GuardItem`；容器响应式宽度、`SearchResults` 三态容器 + 总数 + 加载更多/页内错误重试）；`SuperChatItem`（复用看板组件）新增可选 `highlightKeyword` 入参，非空时留言命中子串以 `<mark>` bg-eye/30 高亮、罗马音行不高亮；页面 `app/backdoor/(dashboard)/danmaku/search/page.tsx`（`"use client"`：页头 + 返回看板 Link + SearchBox + SearchResults）；只读口径——不挂载已读交互。

## 周表 / 直播计划约定

- `features/schedule/`：直播计划业务组件——`CalendarView`（响应式日历：`< 640px` 渲染周视图（单周 7 天 + 周切换 + 今天），`≥ 640px` 维持既有月视图；可选 `variant` `"panel"`（默认，后台逐位保持）| `"immersive"`（全幅直角中字、左右全高翻月竖条、横向拖拽翻月——拖拽超阈值后抑制日期点击防误弹当日详情，`calendarDrag.ts` 位移累积阈值 release 归零）；`selectedDate` 单一事实源，月/周各自派生定位，断点跨越不丢选中日期；周一开头，纯 `YYYY-MM-DD` 字符串比较规避时区；有计划/历史日期展示摘要（月视图至多 2 条、周视图至多 4 条 `HH:mm 主题`，更多以 +N 收尾）；`onRangeChange(from, to)` 上抛可见范围（月视图按展示网格首格~末格、周视图周一~周日），`onSelectDay` 上抛所选日）、`calendarDrag.ts`（横向拖拽翻月纯函数：`createDrag`/`feedPointer` 位移累积/`release` 阈值 60px 返回 -1|0|1 后归零）、`DayDetailDialog`（当日详细安排弹层，`readOnly` 切换只读/管理双模式，管理态含行内编辑/删除二次确认与「+ 增加计划」；**经 `createPortal` 挂 `document.body`**——脱离整页 deck 轨道 `will-change:transform`/`overflow` 祖先，确保 fixed 覆盖层以视口为基准可见）、`PlanFormDialog`（录入/编辑双态表单，父组件变更 key 重置初始值）、`DatePicker`/`TimePicker`（定制选择器，只读输入 + 浮层，键入容错经 `dateUtils.parseTimeStr`/`parseDateStr`，`autoComplete="off"` 关闭浏览器自动填充联想）、`api.ts`（`listPlans`/`createPlan`/`updatePlan`/`deletePlan`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径）、`dateUtils.ts`（日历网格、周计算与时间解析纯函数：`weekDates`/`shiftWeek`/`formatWeekRange` 周计算、`monthGrid`/`monthGridRange`/`monthRange`/`shiftMonth` 月计算——`monthGridRange(y,m)` 返回月视图实际展示网格首格~末格（跨月补位），月视图取数统一用它、`parseDateStr`/`parseTimeStr` 解析）、`useDismiss.ts`（浮层点击外部/Esc 收起）、`CalendarViewPage`（公开日历页主体，接只读 `DayDetailDialog`，传 `variant="immersive"`，容器去 `max-w-[80rem]` 限宽改全幅）；
- 公开日历页 `app/(site)/(content)/calendar/page.tsx`：构建时守卫，未配置 `NEXT_PUBLIC_API_BASE_URL` 直接渲染 `components/NotFoundPage`（不加载日历 chunk、不发请求），已配置时渲染 `CalendarViewPage`；
- 后台直播计划页 `app/backdoor/(dashboard)/schedule/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；日历点击某天弹管理态 `DayDetailDialog`（member 只读降级，与后端 403 口径一致）；弹层内增加（日期预填所选日）/编辑（可改期）/删除（二次确认）后重拉当前月区间，编辑移出所选日提示「已移至 X 月 X 日」；
- 公开页页脚形态：`app/(site)/layout.tsx` 仅渲染 NavBar + `<main>`（**不渲染 Footer**）；首页 `app/(site)/page.tsx` 为整页滚动容器（首页站不渲染 Footer、改文案块下方小号免责声明行），**全站唯一 Footer 在素材站（末站）尾部**流式单行；非首页（`/about` `/assets` `/calendar`，位于路由组 `app/(site)/(content)/`）经 `(content)/layout.tsx` 渲染流式单行 `Footer`。`LiveStatus.tsx`（直播状态组件，Client——`API_CONFIGURED` 守卫未配置返回 null；固定尺寸骨架防 CLS；三态「直播中（状态点 + `animate-pulse`）/未开播/降级中性态」；整体 `<a href={site.links.live} target="_blank" rel="noopener noreferrer">` 点击跳直播间，liveUrl 由服务端 props 传入）、`TodaySchedule.tsx`（今日日程组件，Client——`listPlans(today, today)` 本地时区当天，`HH:mm 主题`，无计划/失败「今日暂无安排」空态）、`api.ts`（`getLiveStatus`，复用 `API_BASE_URL`/`API_CONFIGURED` 口径，未配置或失败静默 `{ok:false, status:null}`）；均由首页站组件（`HeroSection`）仅在 `API_CONFIGURED` 时挂载（组件内亦守卫，双保险）。`ColorChip.tsx`（应援色复制按钮）与 `EntryCard.tsx`（入口卡）已删除；`WeeklySchedule.tsx` 不再由首页挂载。
- 日历混合展示（二期）：`CalendarView` / `DayDetailDialog` 的数据入口为统一条目 `CalendarEntry`（`kind: "plan" | "history"`，由 `mergeEntries(plans, records, now)` 归一化合并——历史记录 `startDate` 按访客本地时区折算 `date`/`startTime`、跨天归开播当日、缺 `title`/`startDate` 丢弃、未来记录不纳入）；历史条目在格子以藤蔓点 + 弱化样式区分来源、恒为「已播出」，在当日弹层带「实际播出」标签并附结束时刻、任何角色只读（无编辑/删除）；计划与历史两路独立加载，历史失败静默降级仅展示计划；
- 历史直播取数：`api.ts` 新增 `LiveRecord` 类型与 `listLiveHistory()`（`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }`）；上游地址收敛在 `servers/api` 服务端（`LIVE_HISTORY_UPSTREAM_URL`），不进前端 bundle；
- 周表图片生成：`features/schedule/weeklyImage/`——`weekUtils.ts`（ISO-8601 周计算纯函数，周一为一周首日）、`layout.ts`（绘制布局纯函数，注入 `measure` 做 shrink-to-fit + 截断）、`renderer.ts`（底图/字体并行预加载 + Canvas 2× 离屏超采样 + `imageSmoothingQuality: "high"` 缩回 1665×1080 + PNG dataURL）、`WeeklyImageDialog.tsx`（周切换器 + 预览 `<img>` + 长按/右键保存提示；打开时一次性 `listPlans` 拉全量，切换周只重跑布局 + 重绘）；后台「直播计划」页新增「生成周表图片」按钮（所有登录角色可用，只读性质）；只渲染人工计划，不渲染历史记录；
- `features/about/parts/`：档案内容五组可复用组件（`ProfilePart`（信息卡，入参 profile+portrait 立绘 Asset；可选 `variant="bare"` 省略立绘缩略图与 LaceFrame，首页档案 P1 右侧信息区用）/`StoryPart`（设定故事，氛围层底色直排，非纸卡）/`TastePart`（喜好标签）/`JourneyPart`（历程 VineTimeline）/`TriviaPart`（逸闻卡 + 官方外链按钮组））+ 共享 `SectionTitle` + `SplitSection`（档案立绘分栏布局：桌面单左双右、移动端默认立绘上内容下；可选 `heroMobilePortrait` 入参使移动端按首页 hero 口径放置——全宽背景立绘（`top-[10%]` 占 `90%` 高、`ml-[25%]` 右偏、`object-cover object-top`、12px 出血）+ 内容浮层（毛玻璃底 `bg-night/70 backdrop-blur-md min-h-full` 铺满整屏），桌面分栏不变——首页档案五屏传入、`/about` 不传；`data-fullpage-scrollable` 内容列滚动兜底（首页 deck 档案屏移动端内容浮层顶部为固定 NavBar 留位 `pt-20`；桌面端内容溢出时初始滚动锚定底部，P4 历程条目超一屏时默认可见最新条目，`/about` 流式页高度自适应不受影响），不约束整屏高度，立绘 **`object-cover object-top` 首页式裁剪、不展示全身像、外包 `ParallaxLayer` 接视差（与首屏一致，公开站氛围层不降级）且立绘四周各外扩 12px（=PARALLAX_MAX）余量——视差最大位移时边缘仍被 overflow-hidden 容器覆盖、不露截断边**——首页 `ArchiveSection` 与 `/about` 复用）；`/about` 页用 ProfilePart 默认 full 变体（内立绘恒为 standing-02），首页档案 P1 用 bare 变体，文案零改动（禁止二次设定）。**分栏大屏立绘映射首页与 /about 不同**：首页 P1 用 bare 无内立绘，大屏按「持书/非持书」错位 P1/P3/P5→standing-02、P2/P4→standing-01；**首页档案五屏移动端背景立绘与桌面共用同一「持书/非持书」cycle 交替（P1/P3/P5→standing-02、P2/P4→standing-01），内容浮层铺满整屏毛玻璃底**；/about 首节「信息」大屏须避开信息卡 standing-02 缩略图同图并排 → 首节大屏 standing-01，其后信息01/设定02/喜好01/历程02/轶闻01。
- 素材 webp：首页立绘大图经 `assetOriginalWebpUrl` 引用 `public/assets/original/<id>.webp`（全分辨率，`scripts/generate-original-webp.ts` 由 PNG 生成并随 `pnpm build` 前置执行）；新增/替换 original 素材后须保证该 webp 存在，否则立绘 404。
- 素材坐标：`public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg` 1665×1080，每日区域 715×70，左上角 x=365，y=278/379/480/580/681/782/883；日期区域 451×40，左上角 x=640，y=80）；底图须随站点同源分发（跨域 CDN 会污染画布导致 `toDataURL` 抛错）。

## 首页氛围动效约定

- `features/home/` 动效与整页滚动模块：
  - `sections.ts`（站序列注册表：`SECTIONS` 8 站 hero→archive-1..5→calendar→assets、`visibleSections(apiConfigured)` 过滤日历站收敛 7 站、`ARCHIVE_TITLES`、`SectionDef`/`SectionId`/`NavKey`、`SECTION_CHANGE_EVENT` 站切换事件）——导航锚点 href、SectionRail 树、deck 站序的单一事实源；
  - `fullpage.ts`（整页翻页纯函数：`createGestureState`/`feedWheel`/`feedTouch` 一次手势一屏 + 冷却、`normalizeDeltaY` wheel 按 deltaMode 归一化为像素（LINE×24/PAGE×0.9×视口高）、阈值 48px 低于单格滚轮 + 手势结束兜底触发（慢速单格一次一屏）、`nextIndex` 钳制、`resolveFlowBoundary` free 顶部回收死区、`easeInOutCubic`；方向约定 -1 向后/ +1 向前）；
  - `sectionRail.ts`（`buildTree` 模块→子内容两层树、`activeNode` 站索引→当前节点）；
  - `useFullpageScroll.ts`（window 被动监听 wheel/touch/键盘，翻页 **rAF 驱动 px 插值转场**（`translate3d(0,-offsetPx,0)`，规避 CSS viewport 单位 transition 插值兼容问题，resize 按 innerHeight 重算）+ 转场期间按滑速派发 `sumire:flow-scroll` 使粒子随页面平移耦合、hash `replaceState` 同步 + 监听 `hashchange`（导航锚点点击/浏览器前进后退定位）、挂载解析初始 hash 直落**仅执行一次**（landedRef 守卫，防 sections 引用变化导致振荡）、free/deck 素材区切换（free 滚动速度连续派发 `sumire:flow-scroll`）、索引变化派发 `sumire:section-change`（deck→NavBar 选中态同步，replaceState 不触发 hashchange）、触摸起始命中 `[data-fullpage-scrollable]` 且实际可滚动时记录容器引用、touchmove 逐次判边界（滚轮同口径），触底/触顶且手势同向越界时交还手势聚合翻页、未到边界维持原生滚动；**free 模式在 scrollTop=0 时上滚/上滑不产生 scroll 事件，故 wheel/touch/keyboard 的「顶部上滚」直接走 `reclaimToDeck` 回收上翻（不依赖 scroll 事件）；free 模式键盘用显式 `scrollBy`（不依赖容器焦点/原生键盘滚动——容器无 tabIndex、视口无溢出，原生键盘滚动不落到容器），方向键↓/↑ 步长约 1/4 屏、PageDown/PageUp 一屏，↑/PageUp 在顶部时回收上翻**）；导出 `IMPULSE_EVENT`/`SCROLL_IMPULSE_EVENT`；公开站氛围层对 reduced-motion 不降级；
  - `FullpageDeck.tsx`（`"use client"` 整页滚动容器：外层 `overflow-hidden`、轨道 `will-change-transform`、`GlowParticles` fixed 常驻 + `SectionRail`，`LockController` 经 body overflow hidden 弹层屏蔽翻页；`sections = useMemo(() => visibleSections(API_CONFIGURED), [])` 稳定引用避免振荡）；
  - `SectionRail.tsx`（固定视口右侧竖向树状指示器，`<nav aria-label="页面位置">`，节点**仅圆点无文字**、经 `aria-label`/`aria-current` 承载可访问性、点击跳转、键盘可达、移动端仅主节点）；
  - `sections/` 四屏组件：`HeroSection`（首页站：雾气+立绘视差+文案块+小号免责声明，无 Footer floating）、`ArchiveSection`（档案五屏立绘单左双右（桌面 order 切换 + 立绘列高度约束防超高裁剪，**section 无纵向 padding 使立绘出血至窗口底边 gap=0**，内容区自带呼吸间距）、**移动端（<1024px）按首页 hero 口径放置：全宽背景立绘（`top-[10%]` 占 `90%` 高、`ml-[25%]` 右偏、`object-cover object-top`、12px 出血、外包 ParallaxLayer 接视差）与桌面共用同一「持书/非持书」cycle 交替（P1/P3/P5→standing-02、P2/P4→standing-01）+ 内容浮层（毛玻璃底 `bg-night/70 backdrop-blur-md min-h-full` 铺满整屏），桌面错位分栏不变**，内容列 `data-fullpage-scrollable` 滚动兜底，**桌面错位立绘仅 standing-01（持书）/standing-02（披肩），按「持书/非持书」错位循环（奇数屏非持书→02、偶数屏持书→01，P1/P3/P5→02、P2/P4→01，避开首页同款持书立绘 standing-01；不用插画）**，复用 `features/about/parts`）、`CalendarSection`（全幅 immersive 月视图，compact 去页头防矮视口裁剪）、`AssetsSection`（全幅素材 + 流式 Footer 全站唯一）；
  - `parallax.ts`（视差纯函数：`pointerOffset`/`tiltOffset`（倾角 ±25° 钳制）/`lerp`，无 DOM 可单测）、`useParallax.ts`（`useParallax(ref)` 接管 transform：window 级被动 `pointermove` + rAF lerp 直写 `ref.style.transform` 不触发 React 重渲染、`pointerleave`/`blur` 回中、收敛停帧；移动端 `deviceorientation` 特性检测，iOS 首次 `touchend` 静默 `requestPermission` 成功挂监听/失败静默放弃）、`ParallaxLayer.tsx`（`"use client"` 视差容器，透传 children 与调用方 className，立绘定位类由调用方决定）、`glowParticles.ts`（粒子纯函数：`spawnPosition`（指针偏置概率 0.6/半径 160px，越界钳制）/`createParticle`/`stepParticles`（可选 `flow` 叠加不破坏现签名）/`maxParticles`，冲量 `createFlow`/`impulse`（方向 ±、强度钳制 `IMPULSE_CAP`）/`decayFlow`（指数衰减半衰期），注入 random 可确定性测试）、`GlowParticles.tsx`（Canvas 2D 粒子层 `canvas[aria-hidden] pointer-events-none fixed inset-0` 常驻视口，rAF 主循环 spawn→step→draw 叠加 `decayFlow`+`impulse` 流场冲量（监听 `IMPULSE_EVENT`/`SCROLL_IMPULSE_EVENT`）、DPR/resize、真实帧间隔 dt、`document.hidden` 暂停、挂载时 `getComputedStyle` 读 `--color-flower`/`--color-primary`/`--color-eye` token 取色，禁硬编码；公开站氛围层对 reduced-motion 不降级）；`app/(site)/page.tsx` 渲染 `<FullpageDeck profile site heroAsset archivePortraits assets />`（Server 外壳，deck 为 Client 叶子），`NavBar` 锚点 href 取自 `sections.ts` 注册表（首页/非首页均锚点，非首页经 hash 直落定位）、选中态首页按 hash/SECTION_CHANGE_EVENT、非首页按 pathname；首页内点击导航派发 `NAVIGATE_EVENT` 由 deck 平滑翻页（Next Link pushState 不触发 hashchange，故不用 hashchange 驱动导航点击）；翻页后经 `SECTION_CHANGE_EVENT` 同步 NavBar 选中态；`DayDetailDialog` 打开时锁 `body.overflow` 供全站弹层屏蔽整页翻页。
- **公开站氛围层不降级 reduced-motion（展示向口径）**：本网站为展示向粉丝站，视差/粒子/翻页转场/冲量流场等氛围动效为核心卖点，**公开站首页氛围层对 `prefers-reduced-motion: reduce` 不降级**——reduced 用户获得与常规一致的完整视差幅度（±12px）、粒子全上限/明灭/冲量、整页 rAF 转场与粒子耦合。此口径**仅限公开站氛围层**（`features/home/*` 与首页 `/`）；后台 `/backdoor` 不适用，仍严格执行 `docs/engineering/frontend-rules.md` 的 reduced-motion 规范。

## 录播页约定

- `features/recordings/`：公开 `/recordings` 录播页（列表直连外部录播服务）与公开 `/recordings/replay` 回放页（视频 + 浮层弹幕 + 事件列表）。录播文件数据直连外部录播服务（**无契约变更**）；**回放事件经 `servers/api` 的公开 `GET /api/live-events/replay` 端点**取得（契约单一事实源 `contract/live-events.openapi.yaml`，无鉴权、剔除 `read`/罗马音）。环境变量 `NEXT_PUBLIC_RECORDINGS_BASE_URL`（生产由 `deploy.yml` 注入公网地址、线上 CDN 已为站点源配置跨域直连；本地 `aspire start` 由 `infra/aspire/apphost.cs` 注入内网地址，浏览器请求同源前缀 `/recordings-proxy` 经 `next.config.ts` 的 dev rewrites 转发到该上游，规避跨域）。`api.ts` 导出 `RECORDINGS_CONFIGURED`（以构建期环境变量是否非空为准）——未配置时导航不渲染「录播」项、页面渲染「服务未配置」空态且请求层短路不 `fetch`（双保险，对齐 `API_CONFIGURED` 口径，独立于后台 API）。
- `api.ts` 消费上游四组端点：`/api/b/live/recording-status`、`/api/b/live/:roomId/recordings`、`/api/b/live/:roomId/recordings/:fileName`（`encodeURIComponent`）、`/api/b/live/:roomId/live-stream/audio`；请求不带凭据，失败静默降级 `{ok:false,...}`。`RecordingFile` 含可选 `info`（`recordingId`/`title`/`mid`/`startedAt`/`endedAt`，字段缺失容忍、无 `info` 不下发）；**回放时间锚点取分段实际起点（`info.startedAt` 推导）而非 `createdAt`**——`createdAt` 是文件落盘（≈分段结束）时刻。新增 `recordingReplayHref(roomId, fileName)` 生成站内回放页地址（`/recordings/replay?roomId=…&file=…`，file 经 `encodeURIComponent`）。
- `useRecordingStatus.ts`（30s 轮询 + 可见性暂停）、`RecordingStatusList`（F2/F3 展示 + 听直播）、`RoomRecordingsGroup`（F4 折叠 + 20/页前端分页；文件名与「播放」均为 `<a target="_blank" rel="noopener noreferrer">` 回放页链接，**不再内联展开播放器**，无展开/折叠单例状态）、`RecordingFileActions`（文件行 split button：主入口「播放」为新标签页回放页链接、`▾` 下拉菜单内 `<a download>` 原生下载、`useDismiss` 点击外部/Esc 收起，纯展示零播放状态）、`RecordingsApp`（列表装配，无 `openFile`/播放器挂载点）。既有分组折叠/分页/听直播/下载行为不变。
- `mpegts.js` 钉死精确版本 `1.8.2`；本地补丁 `patches/mpegts.js@1.8.2.patch` 经 `pnpm-workspace.yaml` 的 `patchedDependencies` 登记，暴露按字节偏移续播（`seekToByteOffset`，含 MSE flush + seek 期间关 lazyLoad 防暂停死锁（guard 可重入、仅最外层捕获/恢复、首个媒体段/3s 超时无条件恢复）+ 复位 LoadingController 暂停态 + `directSeek` 立即对齐 `currentTime` 并周期性夹到缓冲起点 + `resumeTransmuxer`）与 `setBufferLimits`（升级须重制补丁）。
- 页脚：非首页 `(content)` 路由组渲染流式单行 `Footer`，其外链含 `site.links.secretRoom`（「小密室」，原导航外链迁移至此）；导航不再有外链项。
- e2e：`tests/e2e/src/bookstore/recordings.spec.ts` 以 `page.route` mock 四组端点（浏览器侧拦截，基址只需非空），运行需 bookstore 构建/启动时带非空 `NEXT_PUBLIC_RECORDINGS_BASE_URL`；回放页 e2e 另需 mock `**/api/live-events/replay*`。

## 回放页约定

- 路由：`app/(site)/(content)/recordings/replay/page.tsx`（Server 壳：`metadata`「录播回放」+ `RECORDINGS_CONFIGURED` 守卫渲染「服务未配置」空态）+ `<Suspense fallback={null}>` 包 Client `ReplayApp`（SSG 无动态段，`roomId`/`file` 由查询串经 `useSearchParams` 解析）。
- `features/recordings/replay/` 模块结构：
  - `replayEvents.ts`：公开客户端 `fetchReplayEvents({start,end,types?,page?,pageSize?,signal?})`，基址取 `NEXT_PUBLIC_API_BASE_URL` **但不带凭据**（区别于 backdoor `request()`），非 200/异常静默降级 `{ok:false,total:0,items:[]}`；解析后补 `read:false` 并补齐 `sender.nameRomaji/guardLevel`（端点剔除后台语义字段），以复用 `features/danmaku/types.ts` zod schema 与条目组件。
  - `replayWindows.ts`：窗口切分/偏移映射纯函数——`WINDOW_MS=600000`、`windowIndexForOffset=floor(offsetMs/600000)`、`windowBounds`（末窗钳制 `recordEnd`、终点未知以 `recordStart+12h` 为上界）、`offsetMs`、`segmentBoundsForFile`（分段实际区间推导）。**时间锚点 = 分段实际起点（`info.startedAt` 推导），不是 `createdAt`**：`createdAt` 是文件落盘（≈分段结束）时刻；同 `info.recordingId` 多分段按 `createdAt` 升序，首段起于 `info.startedAt`、其后各段起于前一段 `createdAt`，非末段止于本段 `createdAt`、末段止于 `info.endedAt`；`info` 缺失回退 `createdAt`（`fallback=true`）并由 duration 兜底终点。
  - `danmakuOverlay.ts`：轨道分配/调度纯函数（`assignLane` 不重叠轨道、`MAX_ACTIVE_DANMAKU=50` 全满丢弃、`fontSizeForWidth` 基准 32px@1920 且下限 20px、`laneHeightForWidth` 随字号放大保证轨道不重叠、`overlayTopPadding` 为第一行 emote 预留顶部留白、`EMOTE_MAX_SCALE=2` 限制 emote 高度、`danmakuSpeed` 恒定 px/s、`danmakuOffsets`/`selectDanmakusToEmit`/`isSeekJump`）+ canvas 渲染器（rAF 匀速左移、出画回收、暂停挂起、emote `Image` 预载未完成以 alt 文本占位、`setMetrics` 由 `ResizeObserver` 驱动）；DOM/canvas 交互不进 node 单测。
  - `useReplayEvents.ts`：窗口加载调度 + Map 缓存（key 为窗口起点毫秒）+ 代次 last-wins + 卸载 `AbortController` 中止在途请求 + 后半窗预取下一窗 + 页数上限 `MAX_WINDOW_PAGES=20`；`startMs` 为 null 时不发请求。
  - `EventTimeline.tsx`：复用 `features/danmaku/components/` 四类条目（**不传 `onToggleRead`**，无已读语义），按 `occurredAt` 升序；**不渲染「弹幕事件」标题**（仅暂停跟随时右上浮出「回到当前进度」）；**`@tanstack/react-virtual` 虚拟化**（仅渲染可视区，行高 `measureElement` 动态测量，长录播数千条不卡顿）；**桌面（lg+）根节点 `lg:absolute lg:inset-0`**（脱离文档流，虚拟化总高度占位不撑开事件列，由 `ReplayStage` 事件列包裹层 `lg:relative` 提供定位与高度）；`currentTime` 驱动 `scrollToIndex` 自动跟随 + 当前事件 `ring-flower` 高亮；`wheel`/`touchmove` 暂停跟随并浮出「回到当前进度」；点击条目 `onSeek(offsetSeconds)`；错误态 + 重试；空态「本场直播暂无弹幕事件」。
  - `DanmakuOverlay.tsx`：`pointer-events-none absolute inset-0` canvas 浮层，按 `currentTime` 增量发射 danmaku（SC/礼物/上船不进浮层），seek 时清空并按最近 `SEEK_REBUILD_SECONDS` 重建。
  - `ReplayStage.tsx`：接收 `bounds`（分段实际区间，`startMs` 为事件取数锚点、`endMs` 优先于 duration）装配迁移后的 `FlvPlayerPanel`（视频）+ `DanmakuOverlay` + `EventTimeline`；`currentTime` 变化时切换关注窗并预取；双全屏状态机；桌面并排比例为视频 `lg:w-4/5`、事件列 `lg:w-1/5`；事件列不再固定 `70vh`——包裹层 `lg:relative`、`EventTimeline` 内层 `lg:absolute lg:inset-0` 脱离文档流，使虚拟化列表的内容固有高度不参与行高计算，行高由视频列决定、事件列 stretch 至行高并由绝对定位内层填满列内滚动（列内滚动沿用既有虚拟化容器）。
  - `ReplayApp.tsx`：`useSearchParams` 校验 `roomId`/`file` → 回源 `getRoomRecordings(roomId)` 按 `file` 匹配取 `createdAt`/`size`/`info`（不信任 URL 透传元信息）→ `segmentBoundsForFile` 推导分段实际区间 → 三种空态（参数无效 / 录播不存在或已删除 / 服务未配置，均带返回录播页链接）→ 页面结构「标题 + 场次信息 → 舞台」；**舞台下方操作区已移除**（下载迁入播放控制栏，返回入口仅保留在空态）；页面左右留白收窄（`max-w-7xl px-1 lg:px-2`，三态容器同口径）。
- `FlvPlayerPanel.tsx` 由列表迁移至 `replay/` 目录复用，新增可选 props：`overlay?`（绝对定位铺满 `aspect-video` 视频容器）、`onTimeUpdate?`、`onPlayStateChange?`、`controllerRef?`（暴露 `{ seekTo(seconds) }` 走既有 `handleSeek` 路径）、`fullscreen?`（受控双全屏：提供时由 `ReplayStage` 接管状态机，组件不自持 `fullscreenMode`、不挂 `fullscreenchange`、不锁滚动，仅按 `mode` 渲染按钮与容器 ref；导出 `FullscreenMode`/`FlvPlayerPanelController` 类型）。**不渲染标题行与边框/背景包裹**（section 仅 `flex flex-col gap-3`；已移除 `onClose`）；**控制栏含「下载该场录播」**（`iconButtonClass` + `Download`）；**全屏（`mode !== "none"`）时控制栏绝对定位悬浮于视频底部**（`data-testid="fullscreen-controls"`），鼠标移动显现、静止 3s 自动隐藏、悬停不隐藏，非全屏维持流内布局。**默认暂停态**：`paused` 初始 `true`、`start()` 传 `autoplay:false`（仅加载不自动播放，重试后回到暂停态），控制条初始显示「播放」；暂停且未失败时画面内叠加播放按钮 overlay（`data-testid="play-overlay"`、`pointer-events-none`、`aria-hidden`、token 色）；视频容器 `onClick={togglePlay}`（点击画面/overlay/弹幕浮层播放暂停，控制条容器与全屏悬浮层 `stopPropagation`）。视频能力（播放/暂停/音量/进度条/MSE 降级/未缓冲近似 seek + 15s 看门狗）零回归。
- 双全屏作用域：**web 全屏作用于舞台容器**（视频 + 浮层 + 事件列表 `fixed inset-0 z-50` + `document.body` 滚动锁定 + ESC 退出）；**native 全屏仅视频 + 浮层 + 控制条容器**（`data-fullscreen-container`，事件列表不进入）；互斥、`fullscreenchange` 同步、`document.fullscreenEnabled===false` 隐藏全屏入口、卸载退出 native 全屏。
- 浮层视觉：深色卡片流、浮层白色描边文字匀速右→左、焦点环 `--color-flower`，仅用 `@theme` token 色；桌面左右并排（视频 `lg:w-4/5`、事件列 `lg:w-1/5` 等高）、移动端上下堆叠。

提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
