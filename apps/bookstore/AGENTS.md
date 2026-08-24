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
- SideNav `NAV_ITEMS` 当前 5 项（仪表盘/直播计划/弹幕看板/弹幕检索/用户管理），全角色可见项含前四项；选中态通过最长前缀匹配（`pathname.startsWith(item.href)` + `href.length` 降序）判定——`/backdoor/danmaku/search` 命中「弹幕检索」而非「弹幕看板」。
- 弹幕检索 `features/danmaku/search/`：`api.ts`（`searchLiveEvents`，复用 `request()` 支持 AbortSignal 透传）、`highlight.ts`（`splitByKeyword` 基于 `indexOf` 子串切分 + `formatOccurredAt` MM/DD HH:mm）、`useDanmakuSearch.ts`（300ms 防抖 + AbortController 取消 + loadMore append + 追加失败保留已有结果并记录 failedPage + 重试失败页）、`components/`（`SearchBox` 全宽输入框 + 搜索图标 + 清除按钮、`SearchResultCard` 按 `event.type` 分发渲染——`danmaku` 走 `DanmakuCard`（`Sender` compact + `splitByKeyword` 高亮 `<mark>` + emote 渲染 + `formatOccurredAt`）、`super_chat` 走 `SuperChatItem` 传入 `highlightKeyword`、`gift` 走 `GiftItem`、`guard_buy` 走 `GuardItem`；容器响应式宽度、`SearchResults` 三态容器 + 总数 + 加载更多/页内错误重试）；`SuperChatItem`（复用看板组件）新增可选 `highlightKeyword` 入参，非空时留言命中子串以 `<mark>` bg-eye/30 高亮、罗马音行不高亮；页面 `app/backdoor/(dashboard)/danmaku/search/page.tsx`（`"use client"`：页头 + 返回看板 Link + SearchBox + SearchResults）；只读口径——不挂载已读交互。

## 周表 / 直播计划约定

- `features/schedule/`：直播计划业务组件——`CalendarView`（响应式日历：`< 640px` 渲染周视图（单周 7 天 + 周切换 + 今天），`≥ 640px` 维持既有月视图；`selectedDate` 单一事实源，月/周各自派生定位，断点跨越不丢选中日期；周一开头，纯 `YYYY-MM-DD` 字符串比较规避时区；有计划/历史日期展示摘要（月视图至多 2 条、周视图至多 4 条 `HH:mm 主题`，更多以 +N 收尾）；`onRangeChange(from, to)` 上抛可见范围（月视图月区间、周视图周一~周日），`onSelectDay` 上抛所选日）、`DayDetailDialog`（当日详细安排弹层，`readOnly` 切换只读/管理双模式，管理态含行内编辑/删除二次确认与「+ 增加计划」）、`PlanFormDialog`（录入/编辑双态表单，父组件变更 key 重置初始值）、`DatePicker`/`TimePicker`（定制选择器，只读输入 + 浮层，键入容错经 `dateUtils.parseTimeStr`/`parseDateStr`，`autoComplete="off"` 关闭浏览器自动填充联想）、`api.ts`（`listPlans`/`createPlan`/`updatePlan`/`deletePlan`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径）、`dateUtils.ts`（日历网格、周计算与时间解析纯函数：`weekDates`/`shiftWeek`/`formatWeekRange` 周计算、`monthGrid`/`monthRange`/`shiftMonth` 月计算、`parseDateStr`/`parseTimeStr` 解析）、`useDismiss.ts`（浮层点击外部/Esc 收起）、`CalendarViewPage`（公开日历页主体，接只读 `DayDetailDialog`）；
- 公开日历页 `app/(site)/calendar/page.tsx`：构建时守卫，未配置 `NEXT_PUBLIC_API_BASE_URL` 直接渲染 `components/NotFoundPage`（不加载日历 chunk、不发请求），已配置时渲染 `CalendarViewPage`；
- 后台直播计划页 `app/backdoor/(dashboard)/schedule/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；日历点击某天弹管理态 `DayDetailDialog`（member 只读降级，与后端 403 口径一致）；弹层内增加（日期预填所选日）/编辑（可改期）/删除（二次确认）后重拉当前月区间，编辑移出所选日提示「已移至 X 月 X 日」；
- 主页入口 `features/home/WeeklySchedule.tsx`：仅 `API_CONFIGURED` 时由 `app/(site)/page.tsx` 挂载（未配置不留占位）；初始渲染固定最小高度加载骨架，避免 hydration 布局跳动；缎条为 `MON. + HH:mm 主题`（**不混入**历史直播记录，保持一期语义）；
- 日历混合展示（二期）：`CalendarView` / `DayDetailDialog` 的数据入口为统一条目 `CalendarEntry`（`kind: "plan" | "history"`，由 `mergeEntries(plans, records, now)` 归一化合并——历史记录 `startDate` 按访客本地时区折算 `date`/`startTime`、跨天归开播当日、缺 `title`/`startDate` 丢弃、未来记录不纳入）；历史条目在格子以藤蔓点 + 弱化样式区分来源、恒为「已播出」，在当日弹层带「实际播出」标签并附结束时刻、任何角色只读（无编辑/删除）；计划与历史两路独立加载，历史失败静默降级仅展示计划；
- 历史直播取数：`api.ts` 新增 `LiveRecord` 类型与 `listLiveHistory()`（`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }`）；上游地址收敛在 `servers/api` 服务端（`LIVE_HISTORY_UPSTREAM_URL`），不进前端 bundle；
- 周表图片生成：`features/schedule/weeklyImage/`——`weekUtils.ts`（ISO-8601 周计算纯函数，周一为一周首日）、`layout.ts`（绘制布局纯函数，注入 `measure` 做 shrink-to-fit + 截断）、`renderer.ts`（底图/字体并行预加载 + Canvas 2× 离屏超采样 + `imageSmoothingQuality: "high"` 缩回 1665×1080 + PNG dataURL）、`WeeklyImageDialog.tsx`（周切换器 + 预览 `<img>` + 长按/右键保存提示；打开时一次性 `listPlans` 拉全量，切换周只重跑布局 + 重绘）；后台「直播计划」页新增「生成周表图片」按钮（所有登录角色可用，只读性质）；只渲染人工计划，不渲染历史记录；
- 素材坐标：`public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg` 1665×1080，每日区域 715×70，左上角 x=365，y=278/379/480/580/681/782/883；日期区域 451×40，左上角 x=640，y=80）；底图须随站点同源分发（跨域 CDN 会污染画布导致 `toDataURL` 抛错）。

提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
