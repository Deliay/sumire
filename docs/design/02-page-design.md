---
description: 堇色书屋公开页设计现态——全局壳层、首页 deck、档案、素材、日历、录播、回放、棉花糖的页面骨架与组件
type: Permanent
---

# 公开页设计（装订）

视觉 token 与通用规范见 [[01-visual-identity.md]]。页面骨架统一使用 `components/layout/PageShell`、`PageHeader`、`SectionHeader`，组件来自 `components/ui/` 与 `components/patterns/`。

## 1. 全局壳

- `app/(site)/layout.tsx`：skip link（`跳到正文` → `#main`）+ `NavBar` + `<main id="main">`。
- `NavBar` 64px：左字标（宋体站点名 + Cormorant `Sumire`）；导航项 `text-small`、字距 0.04em，活动态 `ink` + 底部 1px `primary` 下划线；默认透明，滚动 >24px 或抽屉展开后 `night/90` + `backdrop-blur` + 底部 1px `line`；移动端全屏抽屉（`dialog` / `aria-modal`、大号列表、底部版权行、Esc / 焦点陷阱 / 滚动锁）。
- `Footer` 版权页：三栏（站点说明 / 导航 / 关注）+ 顶部 1px `line`；导航列按 `API_CONFIGURED` / `RECORDINGS_CONFIGURED` 门控；外链 `↗` 图标 + `rel="noopener noreferrer"`；免责声明完整展示。首页仅在素材站尾部渲染 Footer；非首页经 `(content)/layout.tsx`。
- 404：`404` mono 大号 `text-ink-mute` + `aria-hidden`，语义由 `h1` 承载，`Button` 返回首页。
- `PageShell`：88rem / 44rem 版心、`px-5 sm:px-8 lg:px-16`、`pt-24 lg:pt-32`、`pb-24 lg:pb-32`、桌面装订线 `lg:border-l lg:border-line`。
- `PageHeader` / `SectionHeader`：eyebrow（mono 大写 + 0.12em）+ folio（Cormorant `primary`）+ 标题（宋体 600）+ lead（`ink-dim`，≤38rem）+ actions + 底部 1px `line`。

## 2. 首页 `/`

整页滚动容器（8 站：首页 → 档案五屏 → 日历 → 素材；未配置 API 时 7 站）。翻页仍由 `useFullpageScroll` 驱动：一次手势一屏、480ms rAF 位移、hash 同步；reduced-motion 下直接落位。已删除粒子 / 雾气 / 视差 / 冲量事件。

- **右侧页码索引 `PageIndex`**：`nav aria-label="页面位置"`，中文页码 壹~捌；当前项 16px `primary` 横线 + 中文标签，非当前仅页码；点击经 `goTo` 跳站；`<1024px` 隐藏。移动端顶部 1px `line-strong` 进度条（`aria-hidden`）。
- **Hero**：静态径向微光（`primary/6%`）；桌面 12 列——文字左 5 列、图版右 6 列；书名桌面竖排（`writing-mode: vertical-rl`），移动端横排；`Sumire` 置于书名右下；简介 + 元数据行（直播状态 / 今日日程，行内，1px 下划线）+ 小号免责声明；图版 `h-[55svh] lg:h-[68svh]`、`object-top`。
- **档案五屏**：固定阅读轴，文字左 6 列 / 图版右 5 列（偏移 1 列）；每屏 `SectionHeader`（folio 贰~陆 + eyebrow + 标题）与图版题注。P1 定义表（`ProfilePart` bare）；P2 宋体正文、首行缩进、2px `primary` 引文；P3 方形 `Tag`；P4 `Timeline`；P5 两列 `Surface` + 外链 `Button` + `Rule label="传送门"`。移动端图版在上（40svh）、文字在下，内容列 `data-fullpage-scrollable`；桌面内容溢出时初始锚定底部。
- **日历站**：全幅 immersive 月视图，见 [[../product/spec/calendar.md]]。
- **素材站**：`SectionHeader` + 图版网格 + 全站唯一 `Footer`。
- 档案屏立绘：P1/P3/P5→`standing-02`、P2/P4→`standing-01`，经 original webp，`Plate` 题注。

## 3. 档案页 `/about`

`PageShell width="wide"` + `PageHeader`（`Profile` / 壹 / 枝堇图鉴 / 引文）；五节各一个 `SectionHeader` + 固定阅读轴 `SplitSection`（文字左 / 图版右；移动端图版在上）。首节大屏立绘 `standing-01`（避开信息卡 `standing-02` 缩略图），其后 `01/02/01/02/01` 交错。内文测量宽 ≤36rem。

## 4. 素材页 `/assets`

`PageShell width="wide"` + `PageHeader`（`Assets` / 捌 / 素材架）+ `Notice` 版权说明 + `AssetGallery`。画廊：下划线 tab（`button` + `aria-pressed`，44px 高）→ 图版网格（1/2/3/4 列，`Plate` 题注）→ Lightbox（`night/96`、原图、`Surface` 信息条、`Button` 下载 / 关闭、焦点陷阱、Esc / 遮罩关闭、滚动锁）。

## 5. 录播 / 回放

- `/recordings`：`PageShell width="wide"` + `PageHeader`；实时录制状态（状态药丸 `eye` 呼吸点）+ 分组折叠（`Button` 风格）+ 文件行 hover `bg-soft` + 分页 + 空态 `EmptyState`。
- `/recordings/replay`：`PageShell width="wide"` + `PageHeader`（场次信息）+ `ReplayStage`；视频黑底、弹幕浮层白字、事件列 `Surface outline`；双全屏状态机与全部请求逻辑不变。
- 未配置录播服务：`RECORDINGS_CONFIGURED` 守卫渲染「服务未配置」`EmptyState`，导航不出现「录播」。

## 6. 棉花糖 `/topics`

`PageShell` + `PageHeader`；进行中列表为 `Surface` 卡片；收集页复用 Markdown 编辑器 / 渲染器与 `ConfirmDialog`；错误色统一 `crimson`；提交、限速、客户端 key 逻辑不变。

## 7. 响应式

| 断点 | 导航 | 版心 | 档案 / 图版 | 日历 |
|------|------|------|-------------|------|
| `<640px` | 全屏抽屉 | 单列，gutter 20px | 图版在上（40svh），文字在下 | 周视图 |
| `640–1024px` | 横向导航 | 单列 / 两列，gutter 32px | 图版在上 | 月视图（≥640） |
| `>1024px` | 横向导航 + 装订线 | 12 列，gutter 64px | 文字左 / 图版右 | 月视图 + 拖拽 |
