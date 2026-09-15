# 公开站页面 Spec

堇色书屋公开站是纯静态站点，包含首页、档案页、素材页三个内容页与全局导航。日历页见 [calendar.md](calendar.md)。

## 全局

- 站点定位：枝堇Sumire（VirtuaReal 二十八期）非官方粉丝站，应援色 `#b4a6bf`；素材版权归主播及所属社团所有，内容以官方公开信息为准。
- 页面骨架：固定顶部 NavBar（雾面玻璃，全屏宽；**移动端（<md）默认态即带底色与背景模糊**，桌面端默认透明、滚动 >24px 或菜单展开后雾化）+ 内容区 + Footer（单行：免责声明 + 三个外链）。**Footer 形态按页面区分**：首页为整页滚动容器，首页站不再渲染 Footer，改为文案块下方一行小号免责声明；**全站唯一 Footer 出现在素材站（末站）尾部**为流式单行页脚；非首页（`/about` `/assets` `/calendar`，位于路由组 `(site)/(content)/`）经 `(content)/layout.tsx` 渲染流式单行页脚。
- 视觉基调：深色底、纸页承载长文、藤蔓分割、flower `#8b5fd6` 点睛（单屏 ≤5%）；动效缓慢呼吸。**公开站氛围层（首页视差/粒子/翻页转场/冲量）不降级 reduced-motion**——展示向站点以氛围动效为核心卖点，reduced 用户获得与常规一致体验；后台 `/backdoor` 仍严格尊重 `prefers-reduced-motion`。
- 断点：`<640px` / `640–1024px` / `>1024px`。
- **API 配置降级**：未配置 API 时（`NEXT_PUBLIC_API_BASE_URL` 为空），导航不出现「日历」入口、首页不渲染「直播状态 / 今日日程」组件、`/calendar` 与 `/backdoor` 呈现站点 404，且不发任何 `/api/*` 请求。该口径由 `API_CONFIGURED` 统一控制。
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
- **导航锚点化**（`NavBar`）：导航项 href 改为锚点形态（主页 `/#hero`、档案 `/#archive-1`、素材 `/#assets`、日历 `/#calendar`，hash 取自站序列注册表单一事实源）；首页路由下按 `location.hash` 匹配 navKey 高亮（档案 P1~P5 均视为「档案」选中），deck 翻页经 `SECTION_CHANGE_EVENT` 同步选中态（`replaceState` 不触发 `hashchange`）；非首页路由按既有 pathname 精确匹配选中态（href 仍为锚点，点击跳首页对应锚点，deck 挂载时 hash 直落定位）；未配置 API 时「日历」项缺席。首页内点击导航由 NavBar 派发 `NAVIGATE_EVENT`、deck 监听并平滑翻页（Next Link `pushState` 不触发 `hashchange`，故导航点击不走 hashchange），浏览器前进后退/直接 URL 定位经 `hashchange` 监听。导航列表末尾固定外链项「小密室」（`https://sumire.icu`，新窗口打开，`rel="noopener noreferrer"`），不参与站内锚点选中态与 NAVIGATE_EVENT，恒显示不受 API 配置降级影响。
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
