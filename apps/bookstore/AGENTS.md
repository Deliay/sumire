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

- `features/schedule/`：直播计划业务组件——`CalendarView`（响应式日历：`< 640px` 渲染周视图（单周 7 天 + 周切换 + 今天），`≥ 640px` 维持既有月视图；可选 `variant` `"panel"`（默认，后台逐位保持）| `"immersive"`（全幅直角中字、左右全高翻月竖条、横向拖拽翻月——拖拽超阈值后抑制日期点击防误弹当日详情，`calendarDrag.ts` 位移累积阈值 release 归零）；`selectedDate` 单一事实源，月/周各自派生定位，断点跨越不丢选中日期；周一开头，纯 `YYYY-MM-DD` 字符串比较规避时区；有计划/历史日期展示摘要（月视图至多 2 条、周视图至多 4 条 `HH:mm 主题`，更多以 +N 收尾）；`onRangeChange(from, to)` 上抛可见范围（月视图按展示网格首格~末格、周视图周一~周日），`onSelectDay` 上抛所选日）、`calendarDrag.ts`（横向拖拽翻月纯函数：`createDrag`/`feedPointer` 位移累积/`release` 阈值 60px 返回 -1|0|1 后归零）、`DayDetailDialog`（当日详细安排弹层，`readOnly` 切换只读/管理双模式，管理态含行内编辑/删除二次确认与「+ 增加计划」）、`PlanFormDialog`（录入/编辑双态表单，父组件变更 key 重置初始值）、`DatePicker`/`TimePicker`（定制选择器，只读输入 + 浮层，键入容错经 `dateUtils.parseTimeStr`/`parseDateStr`，`autoComplete="off"` 关闭浏览器自动填充联想）、`api.ts`（`listPlans`/`createPlan`/`updatePlan`/`deletePlan`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径）、`dateUtils.ts`（日历网格、周计算与时间解析纯函数：`weekDates`/`shiftWeek`/`formatWeekRange` 周计算、`monthGrid`/`monthGridRange`/`monthRange`/`shiftMonth` 月计算——`monthGridRange(y,m)` 返回月视图实际展示网格首格~末格（跨月补位），月视图取数统一用它、`parseDateStr`/`parseTimeStr` 解析）、`useDismiss.ts`（浮层点击外部/Esc 收起）、`CalendarViewPage`（公开日历页主体，接只读 `DayDetailDialog`，传 `variant="immersive"`，容器去 `max-w-[80rem]` 限宽改全幅）；
- 公开日历页 `app/(site)/(content)/calendar/page.tsx`：构建时守卫，未配置 `NEXT_PUBLIC_API_BASE_URL` 直接渲染 `components/NotFoundPage`（不加载日历 chunk、不发请求），已配置时渲染 `CalendarViewPage`；
- 后台直播计划页 `app/backdoor/(dashboard)/schedule/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；日历点击某天弹管理态 `DayDetailDialog`（member 只读降级，与后端 403 口径一致）；弹层内增加（日期预填所选日）/编辑（可改期）/删除（二次确认）后重拉当前月区间，编辑移出所选日提示「已移至 X 月 X 日」；
- 公开页页脚形态：`app/(site)/layout.tsx` 仅渲染 NavBar + `<main>`（**不渲染 Footer**）；首页 `app/(site)/page.tsx` 为整页滚动容器（首页站不渲染 Footer、改文案块下方小号免责声明行），**全站唯一 Footer 在素材站（末站）尾部**流式单行；非首页（`/about` `/assets` `/calendar`，位于路由组 `app/(site)/(content)/`）经 `(content)/layout.tsx` 渲染流式单行 `Footer`。`LiveStatus.tsx`（直播状态组件，Client——`API_CONFIGURED` 守卫未配置返回 null；固定尺寸骨架防 CLS；三态「直播中（状态点 + `animate-pulse`）/未开播/降级中性态」；整体 `<a href={site.links.live} target="_blank" rel="noopener noreferrer">` 点击跳直播间，liveUrl 由服务端 props 传入）、`TodaySchedule.tsx`（今日日程组件，Client——`listPlans(today, today)` 本地时区当天，`HH:mm 主题`，无计划/失败「今日暂无安排」空态）、`api.ts`（`getLiveStatus`，复用 `API_BASE_URL`/`API_CONFIGURED` 口径，未配置或失败静默 `{ok:false, status:null}`）；均由首页站组件（`HeroSection`）仅在 `API_CONFIGURED` 时挂载（组件内亦守卫，双保险）。`ColorChip.tsx`（应援色复制按钮）与 `EntryCard.tsx`（入口卡）已删除；`WeeklySchedule.tsx` 不再由首页挂载。
- 日历混合展示（二期）：`CalendarView` / `DayDetailDialog` 的数据入口为统一条目 `CalendarEntry`（`kind: "plan" | "history"`，由 `mergeEntries(plans, records, now)` 归一化合并——历史记录 `startDate` 按访客本地时区折算 `date`/`startTime`、跨天归开播当日、缺 `title`/`startDate` 丢弃、未来记录不纳入）；历史条目在格子以藤蔓点 + 弱化样式区分来源、恒为「已播出」，在当日弹层带「实际播出」标签并附结束时刻、任何角色只读（无编辑/删除）；计划与历史两路独立加载，历史失败静默降级仅展示计划；
- 历史直播取数：`api.ts` 新增 `LiveRecord` 类型与 `listLiveHistory()`（`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }`）；上游地址收敛在 `servers/api` 服务端（`LIVE_HISTORY_UPSTREAM_URL`），不进前端 bundle；
- 周表图片生成：`features/schedule/weeklyImage/`——`weekUtils.ts`（ISO-8601 周计算纯函数，周一为一周首日）、`layout.ts`（绘制布局纯函数，注入 `measure` 做 shrink-to-fit + 截断）、`renderer.ts`（底图/字体并行预加载 + Canvas 2× 离屏超采样 + `imageSmoothingQuality: "high"` 缩回 1665×1080 + PNG dataURL）、`WeeklyImageDialog.tsx`（周切换器 + 预览 `<img>` + 长按/右键保存提示；打开时一次性 `listPlans` 拉全量，切换周只重跑布局 + 重绘）；后台「直播计划」页新增「生成周表图片」按钮（所有登录角色可用，只读性质）；只渲染人工计划，不渲染历史记录；
- `features/about/parts/`：档案内容五组可复用组件（`ProfilePart`（信息卡，入参 profile+portrait 立绘 Asset；可选 `variant="bare"` 省略立绘缩略图与 LaceFrame，首页档案 P1 右侧信息区用）/`StoryPart`（设定故事 PaperCard）/`TastePart`（喜好标签）/`JourneyPart`（历程 VineTimeline）/`TriviaPart`（逸闻卡 + 官方外链按钮组））+ 共享 `SectionTitle`；`/about` 页用 ProfilePart 默认 full 变体，首页档案五屏 `ArchiveSection` 复用同源渲染，文案零改动（禁止二次设定）。
- 素材 webp：首页立绘大图经 `assetOriginalWebpUrl` 引用 `public/assets/original/<id>.webp`（全分辨率，`scripts/generate-original-webp.ts` 由 PNG 生成并随 `pnpm build` 前置执行）；新增/替换 original 素材后须保证该 webp 存在，否则立绘 404。
- 素材坐标：`public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg` 1665×1080，每日区域 715×70，左上角 x=365，y=278/379/480/580/681/782/883；日期区域 451×40，左上角 x=640，y=80）；底图须随站点同源分发（跨域 CDN 会污染画布导致 `toDataURL` 抛错）。

## 首页氛围动效约定

- `features/home/` 动效与整页滚动模块：
  - `sections.ts`（站序列注册表：`SECTIONS` 8 站 hero→archive-1..5→calendar→assets、`visibleSections(apiConfigured)` 过滤日历站收敛 7 站、`ARCHIVE_TITLES`、`SectionDef`/`SectionId`/`NavKey`、`SECTION_CHANGE_EVENT` 站切换事件）——导航锚点 href、SectionRail 树、deck 站序的单一事实源；
  - `fullpage.ts`（整页翻页纯函数：`createGestureState`/`feedWheel`/`feedTouch` 一次手势一屏 + 冷却、`nextIndex` 钳制、`resolveFlowBoundary` free 顶部回收死区、`easeInOutCubic`；方向约定 -1 向后/ +1 向前）；
  - `sectionRail.ts`（`buildTree` 模块→子内容两层树、`activeNode` 站索引→当前节点）；
  - `useFullpageScroll.ts`（window 被动监听 wheel/touch/键盘，翻页直写轨道 `translate3d` 不触发重渲染、hash `replaceState` 同步 + 监听 `hashchange`（导航锚点点击/浏览器前进后退定位）、挂载解析初始 hash 直落**仅执行一次**（landedRef 守卫，防 sections 引用变化导致振荡）、free/deck 素材区切换（free 滚动速度连续派发 `sumire:flow-scroll`）、索引变化派发 `sumire:section-change`（deck→NavBar 选中态同步，replaceState 不触发 hashchange）、reduced-motion 转场淡切 ≤200ms、触摸起始位于 `[data-fullpage-scrollable]` 内不喂入手势聚合（移动端档案内容列交给原生滚动））；导出 `IMPULSE_EVENT`/`SCROLL_IMPULSE_EVENT`；
  - `FullpageDeck.tsx`（`"use client"` 整页滚动容器：外层 `overflow-hidden`、轨道 `will-change-transform`、`GlowParticles` fixed 常驻 + `SectionRail`，`LockController` 经 body overflow hidden 弹层屏蔽翻页；`sections = useMemo(() => visibleSections(API_CONFIGURED), [])` 稳定引用避免振荡）；
  - `SectionRail.tsx`（固定视口右侧竖向树状指示器，`<nav aria-label="页面位置">`，点击跳转、键盘可达、移动端仅主节点）；
  - `sections/` 四屏组件：`HeroSection`（首页站：雾气+立绘视差+文案块+小号免责声明，无 Footer floating）、`ArchiveSection`（档案五屏立绘单左双右（桌面 order 切换 + 立绘列 lg:h-full/min-h-0 高度约束防超高裁剪）、移动端立绘在上内容在下且内容列 `data-fullpage-scrollable` 滚动兜底，复用 `features/about/parts`）、`CalendarSection`（全幅 immersive 月视图，compact 去页头防矮视口裁剪）、`AssetsSection`（全幅素材 + 流式 Footer 全站唯一）；
  - `parallax.ts`（视差纯函数：`pointerOffset`/`tiltOffset`（倾角 ±25° 钳制）/`lerp`，无 DOM 可单测）、`useParallax.ts`（`useParallax(ref)` 接管 transform：window 级被动 `pointermove` + rAF lerp 直写 `ref.style.transform` 不触发 React 重渲染、`pointerleave`/`blur` 回中、收敛停帧；移动端 `deviceorientation` 特性检测，iOS 首次 `touchend` 静默 `requestPermission` 成功挂监听/失败静默放弃）、`ParallaxLayer.tsx`（`"use client"` 视差容器，透传 children 与调用方 className，立绘定位类由调用方决定）、`glowParticles.ts`（粒子纯函数：`spawnPosition`（指针偏置概率 0.6/半径 160px，越界钳制）/`createParticle`/`stepParticles`（可选 `flow` 叠加不破坏现签名）/`maxParticles`，冲量 `createFlow`/`impulse`（方向 ±、强度钳制 `IMPULSE_CAP`）/`decayFlow`（指数衰减半衰期），注入 random 可确定性测试）、`GlowParticles.tsx`（Canvas 2D 粒子层 `canvas[aria-hidden] pointer-events-none fixed inset-0` 常驻视口，rAF 主循环 spawn→step→draw 叠加 `decayFlow`+`impulse` 流场冲量（监听 `IMPULSE_EVENT`，reduced-motion 不注入）、DPR/resize、`document.hidden` 暂停、挂载时 `getComputedStyle` 读 `--color-flower`/`--color-primary`/`--color-eye` token 取色，禁硬编码）；`app/(site)/page.tsx` 渲染 `<FullpageDeck profile site heroAsset archivePortraits assets />`（Server 外壳，deck 为 Client 叶子），`NavBar` 锚点 href 取自 `sections.ts` 注册表（首页/非首页均锚点，非首页经 hash 直落定位）、选中态首页按 hash/SECTION_CHANGE_EVENT、非首页按 pathname；首页内点击导航派发 `NAVIGATE_EVENT` 由 deck 平滑翻页（Next Link pushState 不触发 hashchange，故不用 hashchange 驱动导航点击）；翻页后经 `SECTION_CHANGE_EVENT` 同步 NavBar 选中态；`DayDetailDialog` 打开时锁 `body.overflow` 供全站弹层屏蔽整页翻页。
- **reduced-motion 降级保留（特批口径，仅公开站氛围层）**：经 `lib/useMediaQuery.ts` 响应式订阅 `(prefers-reduced-motion: reduce)`，运行时切换即时生效——鼠标视差幅度降至约 1/3（常规 12px→4px）、传感器不启用（不请求权限不挂监听）、粒子仍渲染但上限减半/漂移速度 ×0.5/取消明灭（alpha 恒定）、整页转场降级为 ≤200ms 淡切（仍可翻页）、冲量不注入（流场恒零）。后台 `/backdoor` 不适用此口径，仍严格执行 `docs/engineering/frontend-rules.md` 的 reduced-motion 规范。

提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
