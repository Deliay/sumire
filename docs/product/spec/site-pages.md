# 公开站页面 Spec

堇色书屋公开站是纯静态站点，包含首页、档案页、素材页三个内容页与全局导航。日历页见 [calendar.md](calendar.md)，录播页见下「录播页 `/recordings`」节。

## 全局

- 站点定位：枝堇Sumire（VirtuaReal 二十八期）非官方粉丝站，应援色 `#b4a6bf`；素材版权归主播及所属社团所有，内容以官方公开信息为准。
- 页面骨架：固定顶部 NavBar（雾面玻璃，全屏宽；**移动端（<md）默认态即带底色与背景模糊**，桌面端默认透明、滚动 >24px 或菜单展开后雾化）+ 内容区 + Footer（单行：免责声明 + 四个外链 B 站空间 / 直播间 / 萌娘百科 / 小密室 `https://sumire.icu`）。**Footer 形态按页面区分**：首页为整页滚动容器，首页站不再渲染 Footer，改为文案块下方一行小号免责声明；**全站唯一 Footer 出现在素材站（末站）尾部**为流式单行页脚；非首页（`/about` `/assets` `/calendar` `/topics` `/recordings`，位于路由组 `(site)/(content)/`）经 `(content)/layout.tsx` 渲染流式单行页脚。
- 视觉基调：深色底、纸页承载长文、藤蔓分割、flower `#8b5fd6` 点睛（单屏 ≤5%）；动效缓慢呼吸。**公开站氛围层（首页视差/粒子/翻页转场/冲量）不降级 reduced-motion**——展示向站点以氛围动效为核心卖点，reduced 用户获得与常规一致体验；后台 `/backdoor` 仍严格尊重 `prefers-reduced-motion`。
- 断点：`<640px` / `640–1024px` / `>1024px`。
- **API 配置降级**：未配置 API 时（`NEXT_PUBLIC_API_BASE_URL` 为空），导航不出现「日历」入口、首页不渲染「直播状态 / 今日日程」组件、`/calendar` 与 `/backdoor` 呈现站点 404，且不发任何 `/api/*` 请求。该口径由 `API_CONFIGURED` 统一控制。
- **录播服务配置降级**：未配置录播服务基址时（`NEXT_PUBLIC_RECORDINGS_BASE_URL` 为空），导航不出现「录播」入口、`/recordings` 展示「录播服务未配置」空态且不发请求。该口径由 `RECORDINGS_CONFIGURED`（`features/recordings/api.ts`）统一控制，独立于 `API_CONFIGURED`。
- 未上线功能不出现在导航与任何入口（如工具集注册表为空即无入口）。

## 首页 `/`

首页为**整页滚动叙事容器**：8 个整屏站（首页 → 档案 P1~P5 → 日历 → 素材）逐屏翻页，一次滚轮/滑动手势一屏（键盘可达，`↓/↑/PageDown/PageUp/Home/End`），素材站为最后一站、尾部释放为自然滚动直至结尾 + 全站唯一流式 Footer；hash 可定位可分享（`/#archive-1` 等）。未配置 API 时日历站从序列/导航/指示器缺席（收敛为 7 站）。

- **整页翻页引擎**（`useFullpageScroll` + `FullpageDeck`）：window 级**被动**监听 wheel/touch/键盘，`feedWheel`/`feedTouch` 聚合手势——同一次手势连续位移超阈值只产出一个方向意图、冷却期不重复；wheel 按 `deltaMode` 归一化为像素（`DOM_DELTA_LINE` 行×24、`DOM_DELTA_PAGE` 页×0.9×视口高），且阈值（48px）低于单格滚轮（Chrome 约 53px、line-mode 约 72px）并带手势结束兜底触发，**慢速单格滚轮一次翻一屏**（触控板连续小 delta 仍由 fired/冷却保证一次手势一屏）；翻页用 **rAF 驱动 px 插值转场**（`translate3d(0, -offsetPx, 0)`，约 800ms 方向感知缓入缓出，规避 CSS viewport 单位 transition 插值兼容问题），**转场期间按滑速向粒子流场派发 velocity 使粒子随页面平移耦合、动画结束即停，冲量滞留衰减作余韵**；resize 时按 `window.innerHeight` 重算 px 偏移。SSG 首渲染即站 0、无 transform（无 hydration 差异），初始 hash 定位在挂载 effect 中执行。索引变化经 `history.replaceState` 同步 hash。
- **可滚动站边界交接翻页**：挂 `data-fullpage-scrollable` 且实际溢出（`scrollHeight > clientHeight + 1`）的容器（档案各站内容列、日历站）内，触摸/滚轮手势**不再整段豁免**：触摸起始记录命中容器，`touchmove` 逐次判边界——容器未到边界时维持原生滚动，**触底（`scrollTop + clientHeight ≥ scrollHeight − 2`）且手势继续向下 / 触顶（`scrollTop ≤ 2`）且手势继续向上**时交还给既有手势聚合链翻上/下一页（`touch` 交接后清除容器引用，同一手势不连翻，冷却 `COOLDOWN=400ms`）；滚轮同理，指针在可滚动列内且列已到边界、滚轮同向越界时走既有 `feedWheel` 翻页，未到边界仍交原生滚动。全程保持 `{ passive: true }`、不 `preventDefault`；非溢出标记（如桌面视口下的日历整 section）不豁免，照常翻页。
- **素材区 deck/free 边界**：素材站（末站）下滚越界进入 free 模式——容器取消 `overflow-hidden`、浏览器接管自然滚动（内容可继续往下滑至素材结尾 + Footer）；free 模式回顶继续上滚回收为 deck 并翻上一站，切换瞬间轨道位移与文档滚动位置对齐、死区（>2px）消除抖动。
- **公开站氛围层不降级 reduced-motion（展示向口径）**：首页视差幅度（±12px）、粒子全上限/明灭/冲量流场、整页 rAF 转场与粒子耦合对 `prefers-reduced-motion: reduce` 一律不降级，reduced 用户体验与常规一致。此口径仅限公开站氛围层；后台 `/backdoor` 不适用。
- **立绘**（`standing-01`）：首页站移动端从顶部 10% 起占 90% 高、全宽并向右偏移 25% 宽裁剪展示（`ml-[25%]`）；桌面端右 10% 起占 90% 高、右半宽且不偏移。作为氛围元素（`pointer-events-none`），不遮挡交互区域。立绘容器外包 `ParallaxLayer`（Client），随鼠标位置产生**视差**（平滑 lerp 跟随、移出/失焦回中、仅 `transform`，幅度上限 12px；移动端以设备方向传感器驱动，iOS 首次触摸静默请求权限、失败静默降级）。
- **背景光晕粒子层**（`GlowParticles`，Canvas 2D）：**`fixed inset-0` 常驻视口**，覆盖全部模块（含素材自然滚动区），雾气层之上、内容之下（DOM 序即 z 序）；随机产生、缓慢漂移明灭；翻页/滚动时沿方向注入**冲量**（`impulse` 强度钳制、`decayFlow` 指数衰减半衰期约 0.5s，停止后滞留上浮/下坠感）；指针（鼠标/触摸点）附近生成密度更高（偏置概率 0.6、半径 160px）；色值运行时读取 `@theme` token（`flower`/`primary`/`eye`）；粒子数按视口面积设上限（桌面约 ≤70）；`document.hidden` 时暂停产生与绘制。公开站氛围层对 reduced-motion 不降级（粒子全上限/明灭/冲量与常规一致）。
- **文案块**（VirtuaReal · 二十八期 / 枝堇 / Sumire / bio）置于**左下角**，留 padding（桌面 > 移动端），错峰入场动画；下方一行小号免责声明行。不再渲染应援色复制按钮。
- **直播状态组件**：展示「直播中 / 未开播」状态（降级为中性状态），点击跳转直播间（新窗口）；仅在 API 配置时渲染，固定尺寸骨架防布局跳动。
- **今日日程组件**：展示当天直播计划（`HH:mm 主题`），无计划展示「今日暂无安排」，失败静默为空态；仅在 API 配置时渲染。
- **档案五屏**（P1 信息・Profile / P2 设定・Story / P3 喜好・Taste / P4 历程・Journey / P5 轶闻・Trivia）：桌面 `grid` 左右分栏——单数屏立绘在左、双数屏立绘在右，内容侧居中收缩（P1~P3/P5 桌面一屏内收敛；**P4 历程条目更新后可能超一屏——桌面端内容列 `overflow-y-auto` 且初始滚动锚定到底部，默认可见最新条目、向上可回看更早条目，时间序不变；`/about` 流式页高度自适应不受影响**）；**档案屏 section 无纵向 padding，立绘列随 grid 出血至窗口底边（gap=0）**，内容区自带纵向呼吸间距；**移动端（<1024px）改按首页 hero 口径放置：全宽背景立绘（`top-[10%]` 起占 `90%` 高、`ml-[25%]` 右偏 25%、`object-cover object-top` 裁剪、四周 12px 出血、外包 ParallaxLayer 接视差，按与桌面同一「持书/非持书」cycle 交替——P1/P3/P5→standing-02、P2/P4→standing-01）+ 内容浮层**（内容浮层带铺满整屏的毛玻璃底 `bg-night/70 backdrop-blur-md min-h-full`，顶部为固定 NavBar 留位 `pt-20`（≥64px），仅移动端生效；桌面错位分栏不变，该背景立绘与毛玻璃仅移动端可见）；立绘**仅用 standing 立绘**（`standing-01`（持书）/`standing-02`（披肩），按**「持书/非持书」错位语义循环选取：奇数屏非持书→standing-02、偶数屏持书→standing-01（P1/P3/P5→standing-02、P2/P4→standing-01，避开首页/信息卡同款持书立绘 standing-01）**，不用插画），经 `assetOriginalWebpUrl` 引用 original 全分辨率 webp（各素材均须有对应 webp，构建时由 `scripts/generate-original-webp.ts` 产出）；**立绘层外包 `ParallaxLayer` 接视差（pointermove+传感器双输入、rAF 插值，与首屏口径一致，公开站氛围层不降级 reduced-motion）**；**立绘元素较裁剪容器四周各外扩 12px（=PARALLAX_MAX）余量**——视差最大位移（±12px）时底/顶/左右边缘仍被 `overflow-hidden` 容器覆盖，不露截断边；**P1 右侧信息区用 `ProfilePart` bare 变体（仅信息表，不含立绘缩略图与蕾丝框，避免与大屏立绘重复）**；P5 末尾含官方外链按钮组。内容复用 `features/about/parts` 五组组件，与 `/about` 同源。
- **日历站**：全幅 `immersive` 月视图（详见 [calendar.md](calendar.md)）；顶部为 fixed NavBar 留位（section `pt-20`）；未配置 API 时该站不注册。
- **素材站**：全幅素材网格（详见素材页节，移动端顶部为固定 NavBar 留位 `pt-20`）+ 尾部流式 `<Footer site />`（全站唯一 Footer）。
- **位置指示器**（`SectionRail`）：固定视口右侧竖向树状节点（模块 → 子内容两层，档案含 5 子节点），左侧 `border-l` 细藤蔓线、档案子层 `border-l` 树状连线；当前站实时高亮（子节点精确到站、档案父节点次级高亮）、点击跳转（同翻页转场）、键盘可达；数据源与 deck 站序列同源（`buildTree`/`activeNode`）；**节点仅展示圆点（无文字标签），可访问性语义经 `aria-label`（信息/设定/喜好/历程/轶闻等）与 `aria-current` 承载**；移动端（<640px）收纳为仅主节点极简形态；仅节点 `<a>` 可点。
- **导航锚点化**（`NavBar`）：导航项 href 改为锚点形态（主页 `/#hero`、档案 `/#archive-1`、素材 `/#assets`、日历 `/#calendar`，hash 取自站序列注册表单一事实源）；首页路由下按 `location.hash` 匹配 navKey 高亮（档案 P1~P5 均视为「档案」选中），deck 翻页经 `SECTION_CHANGE_EVENT` 同步选中态（`replaceState` 不触发 `hashchange`）；非首页路由按既有 pathname 精确匹配选中态（href 仍为锚点，点击跳首页对应锚点，deck 挂载时 hash 直落定位）；未配置 API 时「日历」项缺席。首页内点击导航由 NavBar 派发 `NAVIGATE_EVENT`、deck 监听并平滑翻页（Next Link `pushState` 不触发 `hashchange`，故导航点击不走 hashchange），浏览器前进后退/直接 URL 定位经 `hashchange` 监听。未配置 API 时「日历」项缺席；「棉花糖」与「录播」为独立路由项——「录播」在 `RECORDINGS_CONFIGURED`（录播服务基址非空）时渲染于「棉花糖」同组、工具项之前，选中态走 `pathname === "/recordings"` 精确匹配、无 `sectionId` 不触发 deck 翻页，未配置时不渲染。**导航不再包含外链项**，原「小密室」外链已迁至 Footer 外链区（`https://sumire.icu`，新窗口打开，`rel="noopener noreferrer"`，数据源 `site.links.secretRoom`）。
- 已移除：三张入口卡、信息速览条、本周日程大卡、首页通栏贴底 Footer floating（改为素材尾部流式 Footer + 首页文案块下方小号免责声明）。

## 档案页 `/about`

纯静态内容页，五组档案内容（信息/设定/喜好/历程/轶闻）均以**主页档案屏一致的立绘分栏布局**呈现：桌面 `SplitSection` grid 左右分栏（单数屏立绘在左、双数屏立绘在右，立绘仅用 `standing-01`/`standing-02` 选取、经 original webp 展示，**首页式 `object-cover object-top` 裁剪呈现、不展示全身像，且外包 ParallaxLayer 接视差**），移动端立绘在上、内容在下（内容列可滚动）；自然滚动流式页、不约束整屏高度。**分栏立绘映射与主页不同（/about 首节「信息」用 ProfilePart full，内立绘恒为 standing-02）：首节大屏用 standing-01 避开与信息卡缩略图同图并排，其后按「非持书/持书」错位循环——信息→standing-01、设定→standing-02、喜好→standing-01、历程→standing-02、轶闻→standing-01**。内容：

- 页头引文；
- 信息卡（分栏立绘 + 蕾丝边框 + 档案定义表）；
- 设定故事（出道故事/介绍按段落排版，含「VirtuaReal 预告专栏（节选）」引用块）；
- 喜好标签组（喜欢 / 不喜欢 / 游戏 / 常读·常看（书籍动漫类型）/ 常听（音乐类型）/ 偏好类型（游戏类型））；
- 历程时间线（藤蔓轴，桌面端左右交错、移动端单侧）；
- 逸闻卡片；
- 官方外链按钮。

## 素材页 `/assets`

- 常驻版权提示纸卡（非官方声明）。
- 画廊：分类筛选（全部 / 立绘 / 插画 / 宣传图）、响应式网格（1/2/3/4 列，`xl:grid-cols-4`），立绘完整 contain 展示、其余 cover 裁切，4:5 占位防布局跳动；页面与素材站均全幅占满屏宽（限宽在页面容器处去除，保留左右 padding）。
- Lightbox：Esc 或遮罩关闭、锁定背景滚动、焦点初置关闭键、提供原图下载链接。**弹层（Lightbox 与日历当日详情）经 `createPortal` 挂 `document.body`**，脱离整页滚动容器轨道（`will-change:transform`/`overflow` 祖先会成为 fixed 覆盖层的包含块并裁剪），确保以视口为基准可见；首页内嵌日历站/素材站弹层与独立 `/calendar`、`/assets` 路由行为一致。

## 录播页 `/recordings`

独立公开页（置于 `(site)/(content)/` 路由组，自动获得 NavBar + Footer 外壳；`app/(site)/(content)/recordings/page.tsx` 为服务端壳：`metadata` + `RECORDINGS_CONFIGURED` 守卫 + `<RecordingsApp />`）。数据由前端**直连录播服务**四组端点：生产静态导出用构建期 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 绝对公网地址直连（线上 CDN 已为站点源配置跨域），本地开发用同源前缀 `/recordings-proxy` 经 `next.config.ts` dev rewrites 转发到上游（规避跨域）。本站不存储任何录播数据。未配置基址时页面（及 `RecordingsApp` 内层双保险）渲染「录播服务未配置」空态且不发请求。

- **F1 入口**：导航「录播」项（见全局节），`RECORDINGS_CONFIGURED` 门控。
- **F2 实时录制状态**：顶部区块消费 `GET {BASE}/api/b/live/recording-status`（`{items:[{mid,roomId,state,sessionTitle,updatedAt,streamer:{name}}]}`，前端归一化为 `{roomId,mid,streamerName,state,sessionTitle,updatedAt}`，未知 `state` 归一为 `not_live`，丢弃 `hostName`/`error`）。每项展示主播名、状态药丸（录制中带 `bg-eye animate-pulse` 呼吸点 / 未在直播）、场次标题与更新时间。首拉 + 30s 轮询（`useRecordingStatus`），`document.hidden` 时暂停、`visibilitychange` 恢复可见即刷一次。上游失败展示「录播服务暂时不可用」降级态，不报错页。
- **F3 听直播**：状态为 `recording` 的房间渲染「听直播」按钮，点击经全局单例播放器（`features/recordings/player.ts`）以 mpegts.js 播放 `GET {BASE}/api/b/live/:roomId/live-stream/audio`（`isLive:true`，挂隐藏 `<video>`）；播放中变「停止」，同时只允许一路（切换房间先 `destroy` 旧实例），流错误复位并提示，组件卸载即断流。
- **F4 录播列表**：以 `recording-status` 的 items 为直播间分组（含未在直播者），默认折叠；展开按需拉取 `GET {BASE}/api/b/live/:roomId/recordings`（结果缓存于组件 state，重复折叠/展开不重复请求）；文件项展示文件名、人性化大小（`formatFileSize`）与创建时间（`formatCreatedAt`），按 `createdAt` 倒序；单房间 20 条/页前端分页（本地 slice，不重复请求）；分组加载失败仅本组展示错误 + 「重试」，空列表展示「暂无录播」。
- **F5 回放入口与下载**：点击「播放」主按钮或文件项文件名，**新标签页打开回放页** `/recordings/replay?roomId=:roomId&file=:fileName`（`<a target="_blank" rel="noopener noreferrer">`，`roomId`/`fileName` 经 `encodeURIComponent`），**不再内联展开播放器**（原手风琴展开/折叠、单例互斥与关闭逻辑整体退场）。每个文件项右侧为「播放 + `▾` 下拉」按钮组（`RecordingFileActions`）：主按钮「播放」为回放页链接（与文件名等效），`▾` 下拉开关展开菜单后提供唯一「下载」入口（`<a href download>`，与播放同源 URL，命中上游 `Content-Disposition` 原生下载，URL 与行为不变），菜单支持点击外部 / Esc 关闭，点击「下载」后菜单关闭；默认不直接展示「下载」链接。
- **依赖与性能**：新增唯一运行时依赖 `mpegts.js`（浏览器端动态 `import`，避免 SSG 期求值）；音频流与 FLV 预览为流式直连上游、不整文件缓冲，大文件下载经浏览器原生、不经本站中转。


## 回放页 `/recordings/replay`

独立公开页（`(site)/(content)` 路由组，NavBar + Footer 外壳；`app/(site)/(content)/recordings/replay/page.tsx` 为服务端壳：`metadata`「录播回放」+ `RECORDINGS_CONFIGURED` 守卫 + `<Suspense>` 包 Client `ReplayApp`，查询参数由客户端 `useSearchParams` 解析，SSG 无动态段）。数据来源：录播文件元信息回源 `GET {BASE}/api/b/live/:roomId/recordings` 按 `file` 匹配取 `createdAt`/`size`/`info`（不信任 URL 透传元信息，防参数伪造）；事件数据经本站公开端点 `GET /api/live-events/replay`（见后端直播域 spec）按时间窗口增量加载，并**携带本页 `roomId`**（端点必填参数），确保取到该直播间而非其它房间的弹幕事件。

- **参数与空态**：`roomId`/`file` 缺失或非法 → 「参数无效」空态 + 返回录播页链接且不发请求；录播列表查不到该文件 → 「录播不存在或已删除」空态；`RECORDINGS_CONFIGURED` 为 false → 「服务未配置」空态（与录播页口径一致）。
- **时间锚点（分段实际区间）**：录播文件 `createdAt` 是文件落盘（≈分段结束）时刻，**不是**录制开始；时间锚点取文件 `info.startedAt`。同场次多分段文件共享同一 `info.recordingId`/`startedAt`/`endedAt`，各分段覆盖区间按 `createdAt` 升序推导：首段起点 = `info.startedAt`，其后各段起点 = 前一段 `createdAt`；非末段终点 = 本段 `createdAt`（与下一段衔接），末段终点 = `info.endedAt`。`info` 缺失时回退 `createdAt` 为起点（近似，误差为整场时长），终点交由视频 duration 推算兜底。
- **布局**：页面结构自上而下为标题「录播回放」+ 场次信息（场次标题 `info.title`（有才显示）/ 文件名 / 直播间 / 开始时间 `info.startedAt`（缺失回退 `createdAt`））→ 回放舞台（舞台下方操作区已移除，「下载该场录播」迁入播放控制栏）。页面左右留白收窄为 `px-1 lg:px-2`（`max-w-7xl` 容器不变，空态/加载态同口径）；桌面端左视频列 `lg:w-4/5`（16:9 黑底）、右弹幕事件列 `lg:w-1/5`，二者同处 `lg:flex-row` 弹性行；事件列包裹层 `lg:relative`、`EventTimeline` 内层 `lg:absolute lg:inset-0` 脱离文档流（虚拟化列表的数千 px 总高度占位不参与行高计算，桌面行高由视频列决定），事件列 stretch 至行高、绝对定位内层填满并在列内滚动（不再固定 `70vh`，虚拟化滚动容器既有不变），移动端上下堆叠。
- **视频区**：复用迁移后的 `FlvPlayerPanel`（mpegts.js 播放、进度条近似 seek、音量、播放/暂停、时间、MSE 不可用降级为「不支持在线播放，请下载后收听」+ 下载按钮），控制条含「网页全屏」「全屏」入口。**默认暂停态**：加载完成后仅 `load()` 不自动 `play()`（`play()` 传 `autoplay:false`，规避浏览器对带声音自动播放的拦截），控制条初始显示「播放」；暂停态画面中央叠加播放按钮 overlay（`pointer-events-none` 纯视觉层、`aria-hidden`，仅用 `@theme` token 色）；**点击视频画面任意区域**（含 overlay 与其上 `pointer-events-none` 的弹幕浮层）经 `togglePlay` 播放/暂停、与控制条按钮共享同一状态，点击控制条/进度条/音量/全屏等区域不触发画面切换（控制条 `stopPropagation`）；失败态与 MSE 降级态不展示 overlay；全屏（web/native）下画面点击与 overlay 行为一致。
- **漂浮弹幕**：`DanmakuOverlay` canvas 2D + rAF 浮层（`position:absolute inset-0`、`pointer-events:none`），仅 `danmaku` 类事件入浮层（SC/礼物/上船仅列表）；按事件 `occurredAt` 映射视频时间轴，播放前进时将 `offset ∈ (prevT, t]` 的弹幕入队发射，白色描边文字匀速右→左，多轨道避免重叠、同屏上限 50 条超出丢弃最早批次；暂停悬停、seek 清空并按新落点重建；emote 图片预载未完成以 alt 文本占位；`ResizeObserver` 同步 canvas 尺寸。
- **事件列表**：`EventTimeline` 复用弹幕看板条目组件（不传已读交互、不置灰），按 `occurredAt` 升序展示该场次四类事件；播放中自动滚动跟随并高亮当前事件，用户手动滚动（wheel/touch）暂停跟随并浮出「回到当前进度」恢复；点击条目调用舞台 seek 到该事件时间点；加载失败仅事件区错误态 + 重试（视频不受影响）；无事件展示「本场直播暂无弹幕事件」空态。
- **事件取数**：`useReplayEvents` 以分段实际起点（`info.startedAt` 推导）为原点按 10min 窗口对齐切分（`windowIndex = floor(offsetMs/600_000)`），逐窗调 `fetchReplayEvents` 并翻页取尽（页数上限 20），Map 缓存窗口结果（seek 往返不重复请求），代次 last-wins 治理快速连续 seek，卸载中止在途请求；分段终点未知前仅加载首窗（上界取 `recordStart+12h` 截断到契约上限），就绪后按 `recordEnd` 精确化；播放进入窗口后半段预取下一窗。
- **双全屏（F4）**：「网页全屏」作用于**舞台容器**（视频 + 浮层 + 事件列表）`fixed inset-0 z-50` + `document.body` 滚动锁定 + ESC 退出，事件列表在网页全屏下可滚动、可点击跳转；「全屏」经 Fullscreen API 仅将**视频 + 浮层容器**进入系统全屏（事件列表不进入），控制条保持可用；两者互斥、`fullscreenchange` 同步按钮态、卸载退出 native 全屏；`document.fullscreenEnabled === false` 时隐藏「全屏」入口（网页全屏不受影响）；canvas 浮层随容器尺寸变化重建坐标系。
- **降级**：iOS Safari 无 MSE 时视频区降级为下载提示，事件列表仍正常展示。