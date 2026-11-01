# 公开站页面 Spec

堇色书屋公开站为纯静态站点（SSG），包含首页、档案页、素材页、日历页、录播页、回放页、棉花糖页与站点 404。视觉规范见 `docs/design/01-visual-identity.md` 与 `02-page-design.md`；日历交互见 [calendar.md](calendar.md)。

## 全局

- 固定顶部 NavBar 64px + 正文 + 页脚。默认透明，滚动 >24px 或移动抽屉展开后 `night/90` + 背景模糊 + 底部 1px `line`。
- 导航项：主页 / 档案 / 素材 / 日历（`API_CONFIGURED`） / 棉花糖（`API_CONFIGURED`） / 录播（`RECORDINGS_CONFIGURED`）；活动态 `aria-current="page"`。首页内点为锚点翻页（`NAVIGATE_EVENT`），非首页点跳首页锚点；「棉花糖」「录播」为独立路由，不触发 deck 翻页。
- skip link「跳到正文」指向 `main#main`；移动抽屉为 `role="dialog"` + `aria-modal`，Esc 关闭、焦点陷阱、锁定背景滚动、关闭后焦点回到触发按钮。
- Footer 版权页三栏（站点说明 / 导航 / 关注）+ 顶部 1px `line`；首页唯一 Footer 位于素材站尾部，非首页经 `(content)/layout.tsx` 渲染。外链 B 站空间 / 直播间 / 萌娘百科 / 小密室（`rel="noopener noreferrer"`）。
- 断点：`<640px` / `640–1024px` / `>1024px`；公开页桌面绘制 1px 装订线（`PageShell`）。
- 降级：未配置 `NEXT_PUBLIC_API_BASE_URL` 时导航无「日历 / 棉花糖」、首页不渲染直播状态与今日日程、`/calendar` 与 `/backdoor` 渲染站点 404、请求层短路；未配置 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 时导航无「录播」、`/recordings` 与回放页渲染「服务未配置」空态。
- 未上线功能不出现入口。

## 首页 `/`

整页滚动叙事容器：8 站（首页 → 档案 P1~P5 → 日历 → 素材），未配置 API 时 7 站。一次滚轮 / 触摸手势一屏（键盘 `↓/↑/PageDown/PageUp/Home/End`），480ms rAF 位移转场；hash 可分享（`/#archive-1` 等）；`prefers-reduced-motion` 下翻页直接落位。

- **页码索引 `PageIndex`**：右侧固定 `nav aria-label="页面位置"`，中文页码 壹~捌，当前项 16px `primary` 横线 + 标签，点击跳站；`<1024px` 隐藏，移动端顶部显示 1px 进度条。
- **Hero**：桌面竖排书名（移动横排）、`Sumire` 字标、简介、元数据行（直播状态链接 + 今日日程）、小号免责声明、右侧图版（`standing-01`，1px 描边 + 题注）。无雾气 / 粒子 / 视差。
- **档案五屏**：固定阅读轴（文字左 / 图版右），每屏 `SectionHeader`（folio 贰~陆）与图版题注；P1 信息定义表、P2 设定正文（首行缩进 + `primary` 引文）、P3 喜好 `Tag`、P4 历程 `Timeline`、P5 轶闻 `Surface` + 外链 `Button`。移动端图版在上（40svh）、文字在下；内容列可滚动，桌面溢出时初始锚定底部。
- **日历站**：全幅 immersive 月视图（见 calendar.md）；未配置 API 时缺席。
- **素材站**：`SectionHeader` + 图版网格 + 全站唯一 Footer。
- 直播状态：三态「直播中（`eye` 呼吸点）/ 未开播 / 降级中性态」，点击新窗口跳直播间；API 未配置不渲染。今日日程：`HH:mm 主题`，无计划「今日暂无安排」，失败静默空态；两者为行内元数据，无卡片、无标题。

## 档案页 `/about`

`PageShell width="wide"` + `PageHeader`（eyebrow `Profile`、folio 壹、标题「枝堇图鉴」、引文）；五节（信息 / 设定 / 喜好 / 历程 / 轶闻）各一个 `SectionHeader` 与固定阅读轴 `SplitSection`。立绘 `standing-01` / `standing-02` 交错（首节大屏避开信息卡同图），original webp；内文宽 ≤36rem。自然滚动，不约束整屏高度。

## 素材页 `/assets`

`PageShell width="wide"` + `PageHeader`（`Assets` / 捌 / 素材架）+ `Notice` 版权说明 + `AssetGallery`。分类为下划线 tab（全部 / 立绘 / 插画 / 宣传图，`aria-pressed`，44px 高）；图版网格 1/2/3/4 列，题注含编号、标题与分类；Lightbox 展示原图缩略与信息条（标题 / 分类 / 尺寸 / 备注）+「下载原图」与「关闭」，Esc / 遮罩关闭、焦点陷阱、滚动锁。

## 录播页 `/recordings`

`PageShell width="wide"` + `PageHeader`；实时录制状态、在线听直播、分组录播列表（折叠 + 20/页前端分页）、文件播放（新窗口回放页）与原生下载。未配置录播服务时渲染「服务未配置」空态。请求与业务状态机不变。

## 回放页 `/recordings/replay`

`PageShell width="wide"` + `PageHeader`（场次信息）+ `ReplayStage`：视频 + Canvas 弹幕浮层 + 事件列；默认暂停；web / native 双全屏；事件列虚拟化、当前事件高亮、点击 seek。查询参数 `roomId` / `file` 校验失败或录播不存在时展示对应空态并返回录播列表。

## 棉花糖 `/topics`

无 `id` 查询串：`PageShell` + `PageHeader` + 进行中主题 `Surface` 列表；`?id=`：主题信息 + Markdown 渲染 + 投递表单（字数限制、限速、客户端 key）。未配置 API 时渲染站点 404。

## 404

`404` mono 大号（`text-ink-mute`、`aria-hidden`）+ `h1`「页面不存在」+ 说明 + 「返回首页」按钮；无径向紫光与花体字。后台未配置 API 时复用同一页面。
